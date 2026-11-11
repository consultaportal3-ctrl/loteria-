'use strict';
const {isIP} = require('node:net');
const {ApiError, env} = require('./api-bootstrap.js');
const store = require('./redis-store.js');
const BLOCKS = 'security:ip-blocks';
const TRAFFIC = 'security:ip-traffic';
const INDEX = 'security:ip-index';
const SETTINGS = 'security:ip-settings';
const defaults = {automatic:false, maxRequests:60, durationMinutes:15};
function normalizeIp(value) {
  if (typeof value !== 'string') return '';
  value = value.trim().toLowerCase();
  if (value.includes('%')) return '';
  if (value.startsWith('::ffff:') && isIP(value.slice(7)) === 4) value = value.slice(7);
  const version = isIP(value);
  if (!version) return '';
  if (version === 4) return value;
  const normalized = new URL('http://[' + value + ']').hostname.slice(1,-1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(normalized);
  if (mapped) return mapped.slice(1).flatMap(part => { const number=parseInt(part,16); return [number>>8,number&255]; }).join('.');
  return normalized;
}
function clientIp(req) {
  const header = name => typeof req.headers?.get === 'function' ? req.headers.get(name) : req.headers?.[name];
  if (env('VERCEL') === '1') {
    const forwarded = header('x-vercel-forwarded-for') || header('x-forwarded-for');
    return normalizeIp(typeof forwarded === 'string' ? forwarded.split(',')[0] : '');
  }
  return normalizeIp(req.socket?.remoteAddress || '');
}
function bypass(path) {
  return /^\/(?:assets\/|_vercel\/|\.well-known\/)/i.test(path)
    || /^\/(?:painel(?:\.html)?\/?|api\/(?:pix-settings|admin|webhook)(?:\.js)?\/?)$/i.test(path);
}
async function inspect(req, page, countPage = true) {
  const ip = clientIp(req);
  if (!ip || !store.configured() || bypass(page)) return {allowed:true};
  const now = Date.now();
  const raw = await store.command('EVAL', `
    -- ip-access-check
    local now = tonumber(ARGV[2])
    local recordRaw = redis.call('HGET', KEYS[2], ARGV[1])
    local record = recordRaw and cjson.decode(recordRaw) or {ip=ARGV[1], total=0, denied=0}
    local blockRaw = redis.call('HGET', KEYS[1], ARGV[1])
    local block = blockRaw and cjson.decode(blockRaw) or nil
    if block and block.expiresAt > 0 and block.expiresAt <= now then
      redis.call('HDEL', KEYS[1], ARGV[1])
      block = nil
    end
    local settingsRaw = redis.call('GET', KEYS[4])
    local settings = settingsRaw and cjson.decode(settingsRaw) or cjson.decode(ARGV[5])
    if ARGV[4] == '1' and not block then
      local count = redis.call('INCR', KEYS[5])
      if count == 1 then redis.call('EXPIRE', KEYS[5], 120) end
      record.minute = tonumber(ARGV[6])
      record.minuteCount = count
      record.total = record.total + 1
      if settings.automatic and count > settings.maxRequests then
        block = {ip=ARGV[1], createdAt=now, expiresAt=now + settings.durationMinutes * 60000, automatic=true, reason='Limite de acessos por minuto excedido'}
        redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(block))
      end
    end
    if block then record.denied = record.denied + 1 end
    if ARGV[4] == '1' or block then
      record.lastSeen = now
      record.page = ARGV[3]
      redis.call('HSET', KEYS[2], ARGV[1], cjson.encode(record))
      redis.call('ZADD', KEYS[3], now, ARGV[1])
      local size = redis.call('ZCARD', KEYS[3])
      if size > 1000 then
        local oldest = redis.call('ZRANGE', KEYS[3], 0, size - 1001)
        for _, key in ipairs(oldest) do redis.call('HDEL', KEYS[2], key); redis.call('ZREM', KEYS[3], key) end
      end
    end
    if block then return cjson.encode({allowed=false, automatic=block.automatic, expiresAt=block.expiresAt}) end
    return cjson.encode({allowed=true})
  `, 5, BLOCKS, TRAFFIC, INDEX, SETTINGS, 'security:ip-minute:' + ip + ':' + Math.floor(now / 60000),
    ip, now, String(page).split('?')[0].slice(0,240), countPage ? '1' : '0', JSON.stringify(defaults), Math.floor(now / 60000));
  return JSON.parse(raw);
}
async function list(req) {
  const [settings, keys, rawBlocks] = await Promise.all([store.get(SETTINGS), store.command('ZREVRANGE', INDEX, 0, 99), store.command('HVALS', BLOCKS)]);
  const rows = keys.length ? await store.command('HMGET', TRAFFIC, ...keys) : [];
  const now = Date.now(), minute = Math.floor(now / 60000);
  const blocks = rawBlocks.map(row => JSON.parse(row)).filter(row => !row.expiresAt || row.expiresAt > now).sort((a,b) => b.createdAt-a.createdAt);
  return {settings:settings || {...defaults}, currentIp:clientIp(req), configured:store.configured(),
    traffic:rows.filter(Boolean).map(row => { const value=JSON.parse(row); return {...value, minuteCount:value.minute === minute ? value.minuteCount : 0}; }), blocks, updatedAt:now};
}
async function block(req, input) {
  const ip = normalizeIp(input.ip);
  if (!ip) throw new ApiError(422, 'Informe um IP IPv4 ou IPv6 válido.');
  if (ip === clientIp(req)) throw new ApiError(422, 'Este é o seu IP atual. Escolha outro IP para bloquear.');
  if (![0,15,60,1440,10080].includes(input.durationMinutes)) throw new ApiError(422, 'Prazo de bloqueio inválido.');
  const now = Date.now();
  const record = {ip,createdAt:now,expiresAt:input.durationMinutes ? now+input.durationMinutes*60000 : 0,automatic:false,
    reason:typeof input.reason === 'string' ? input.reason.trim().slice(0,160) : ''};
  await store.command('HSET', BLOCKS, ip, JSON.stringify(record));
  return {blocked:true, ip};
}
async function unblock(input) {
  const ip = normalizeIp(input.ip);
  if (!ip) throw new ApiError(422, 'Informe um IP válido.');
  await store.command('HDEL', BLOCKS, ip);
  return {unblocked:true, ip};
}
async function saveSettings(input) {
  if (!input || typeof input.automatic !== 'boolean' || !Number.isInteger(input.maxRequests) || input.maxRequests < 10 || input.maxRequests > 1000
    || ![5,15,60,1440].includes(input.durationMinutes)) throw new ApiError(422, 'Confira o limite (10 a 1.000 acessos por minuto) e a duração.');
  const settings = {automatic:input.automatic,maxRequests:input.maxRequests,durationMinutes:input.durationMinutes};
  await store.command('SET', SETTINGS, JSON.stringify(settings));
  return {settings};
}
module.exports = {normalizeIp,clientIp,bypass,inspect,list,block,unblock,saveSettings};
