'use strict';
const {randomBytes} = require('node:crypto');
const {ApiError, env} = require('./api-bootstrap.js');
const store = require('./redis-store.js');
const WINDOW = 90000;
const INDEX = 'visitors:online';
const HISTORY = 'visitors:history';
const RECORDS = 'visitors:records';
const visitorId = req => /(?:^|;\s*)site_visitor=([a-f0-9]{32})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
function tabId(input) {
  if (input.tabId === undefined) return 'legacy';
  if (typeof input.tabId !== 'string' || !/^[a-f0-9]{32}$/.test(input.tabId)) throw new ApiError(422, 'Aba inválida.');
  return input.tabId;
}
function location(req) {
  const field = name => {
    if (env('VERCEL') !== '1') return '';
    const value = req.headers[name];
    if (typeof value !== 'string') return '';
    try { return decodeURIComponent(value).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 100); }
    catch { return ''; }
  };
  return {city:field('x-vercel-ip-city'), region:field('x-vercel-ip-country-region'), country:field('x-vercel-ip-country')};
}
async function heartbeat(req, res, input) {
  if (typeof input.page !== 'string' || !/^\/[a-zA-Z0-9/_.,%-]*$/.test(input.page) || input.page.length > 160 || /painel|api\//i.test(input.page)) {
    throw new ApiError(422, 'Página inválida.');
  }
  const id = visitorId(req) || randomBytes(16).toString('hex');
  const tab = tabId(input);
  const now = Date.now();
  const visitor = {id, ...location(req), page:input.page, lastSeen:now};
  await store.command('EVAL', `
    -- visitor-heartbeat
    if redis.call('EXISTS', KEYS[7]) == 1 then return 0 end
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
    if redis.call('SET', KEYS[3], '1', 'NX', 'EX', 20) then
      redis.call('ZREMRANGEBYSCORE', KEYS[6], '-inf', ARGV[1])
      redis.call('ZADD', KEYS[6], ARGV[2], ARGV[5])
      redis.call('EXPIRE', KEYS[6], 180)
      redis.call('SET', KEYS[2], ARGV[3], 'EX', 90)
      redis.call('ZADD', KEYS[1], ARGV[2], KEYS[2])
      redis.call('EXPIRE', KEYS[1], 180)
      redis.call('HSET', KEYS[4], ARGV[4], ARGV[3])
      redis.call('ZADD', KEYS[5], ARGV[2], ARGV[4])
    end
    return 1
  `, 7, INDEX, 'visitors:session:' + id, 'visitors:rate:' + id + ':' + tab, RECORDS, HISTORY, 'visitors:tabs:' + id, 'visitors:closed:' + id + ':' + tab, now - WINDOW, now, JSON.stringify(visitor), id, tab);
  res.setHeader('Set-Cookie', `site_visitor=${id}; Path=/; HttpOnly; Secure; SameSite=Lax`);
}
async function leave(req, input) {
  const tab = tabId(input), id = visitorId(req);
  if (!id || tab === 'legacy') return;
  await store.command('EVAL', `
    -- visitor-leave
    redis.call('SET', KEYS[3], '1', 'EX', 180)
    redis.call('ZREM', KEYS[2], ARGV[1])
    redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[2])
    local latest = redis.call('ZREVRANGE', KEYS[2], 0, 0, 'WITHSCORES')
    if #latest == 0 then
      redis.call('ZREM', KEYS[1], ARGV[3])
    elseif redis.call('ZSCORE', KEYS[1], ARGV[3]) then
      redis.call('ZADD', KEYS[1], latest[2], ARGV[3])
    end
    return 1
  `, 3, INDEX, 'visitors:tabs:' + id, 'visitors:closed:' + id + ':' + tab, tab, Date.now() - WINDOW, 'visitors:session:' + id);
}
async function list(offset = 0) {
  offset = Math.max(0, Math.min(100000000, Number.parseInt(offset, 10) || 0));
  const now = Date.now();
  await store.command('ZREMRANGEBYSCORE', INDEX, '-inf', now - WINDOW);
  const keys = await store.command('ZREVRANGE', HISTORY, offset, offset + 99);
  const records = keys.length ? await store.command('HMGET', RECORDS, ...keys) : [];
  const rows = records.filter(Boolean).map(record => JSON.parse(record));
  const scores = rows.length ? await store.command('ZMSCORE', INDEX, ...rows.map(row => 'visitors:session:' + row.id)) : [];
  const visitors = rows.map((row, index) => ({...row, online:scores[index] !== null && Number(scores[index]) > now - WINDOW}));
  const count = Number(await store.command('ZCARD', INDEX));
  const total = Number(await store.command('ZCARD', HISTORY));
  return {visitors, count, total, offset, limit:100, windowSeconds:90, updatedAt:now};
}
async function clear() {
  await store.command('DEL', HISTORY, RECORDS, INDEX);
  return {cleared:true};
}
module.exports = {heartbeat, leave, list, clear, location};
