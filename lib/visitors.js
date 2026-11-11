'use strict';
const {randomBytes} = require('node:crypto');
const {ApiError, env} = require('./api-bootstrap.js');
const store = require('./redis-store.js');
const WINDOW = 90000;
const INDEX = 'visitors:online';
const HISTORY = 'visitors:history';
const RECORDS = 'visitors:records';
const GENERATIONS = 'visitors:generations';
const GENERATION_INDEX = 'visitors:generation-index';
const GENERATION_TOTALS = 'visitors:generation-totals';
const IMPORT_CURSOR = 'visitors:generation-import';
const saveGenerationLua = `
  local function saveGeneration(event, visitor)
    if event.type ~= 'generated_game' and event.type ~= 'pix_generated' then return end
    if not event.id then return end
    local key = event.type == 'pix_generated' and event.id or visitor.id .. ':' .. event.id
    if redis.call('HEXISTS', '${GENERATIONS}', key) == 1 then return end
    event.visitorId = visitor.id
    event.city = visitor.city
    redis.call('HSET', '${GENERATIONS}', key, cjson.encode(event))
    redis.call('ZADD', '${GENERATION_INDEX}', event.at, key)
    if event.type == 'generated_game' then
      redis.call('HINCRBY', '${GENERATION_TOTALS}', 'generatedCount', 1)
    else
      redis.call('HINCRBY', '${GENERATION_TOTALS}', 'pixCount', 1)
      if event.simulation then
        redis.call('HINCRBY', '${GENERATION_TOTALS}', 'simulationCount', 1)
      else
        redis.call('HINCRBY', '${GENERATION_TOTALS}', 'pixAmount', event.amount or 0)
      end
    end
  end
`;
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
  if (typeof input.page !== 'string' || !/^\/[a-zA-Z0-9/_.,%-]*(?:#[a-zA-Z0-9_-]{1,80})?$/.test(input.page) || input.page.length > 240 || /painel|api\//i.test(input.page)) {
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
    local raw = redis.call('HGET', KEYS[4], ARGV[4])
    local prior = raw and cjson.decode(raw) or {}
    local incoming = cjson.decode(ARGV[3])
    if redis.call('SET', KEYS[3], '1', 'NX', 'EX', 20) or (ARGV[5] ~= 'legacy' and prior.page ~= incoming.page) then
      incoming.firstSeen = prior.firstSeen or incoming.lastSeen
      incoming.events = prior.events or {}
      incoming.generatedCount = prior.generatedCount or 0
      incoming.pixCount = prior.pixCount or 0
      if prior.page ~= incoming.page then
        table.insert(incoming.events, {type='page', page=incoming.page, at=incoming.lastSeen})
        while #incoming.events > 100 do table.remove(incoming.events, 1) end
      end
      local encoded = cjson.encode(incoming)
      redis.call('ZREMRANGEBYSCORE', KEYS[6], '-inf', ARGV[1])
      redis.call('ZADD', KEYS[6], ARGV[2], ARGV[5])
      redis.call('EXPIRE', KEYS[6], 180)
      redis.call('SET', KEYS[2], encoded, 'EX', 90)
      redis.call('ZADD', KEYS[1], ARGV[2], KEYS[2])
      redis.call('EXPIRE', KEYS[1], 180)
      redis.call('HSET', KEYS[4], ARGV[4], encoded)
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
function generatedItem(input) {
  const games = ['mega','facil','quina','milionaria','mania','timemania','dupla','dia','loteca','super'];
  if (!input || !games.includes(input.game)) throw new ApiError(422, 'Modalidade inválida.');
  const item = {game:input.game};
  const numbers = (value, maxLength, max) => {
    if (!Array.isArray(value) || value.length > maxLength || value.some(n => !Number.isInteger(n) || n < 0 || n > max)) throw new ApiError(422, 'Seleção inválida.');
    return [...value];
  };
  if (input.numbers !== undefined) item.numbers = numbers(input.numbers, 50, 99);
  if (input.trevos !== undefined) item.trevos = numbers(input.trevos, 6, 6);
  if (input.picks !== undefined) item.picks = numbers(input.picks, 14, 7);
  if (input.columns !== undefined) {
    if (!Array.isArray(input.columns) || input.columns.length !== 7) throw new ApiError(422, 'Colunas inválidas.');
    item.columns = input.columns.map(column => numbers(column, 10, 9));
  }
  if (input.special === 'virada') item.special = 'virada';
  if (Number.isInteger(input.contest) && input.contest > 0 && input.contest < 1000000) item.contest = input.contest;
  if (Number.isInteger(input.month) && input.month >= 0 && input.month < 12) item.month = input.month;
  if (Number.isInteger(input.repeats) && input.repeats > 0 && input.repeats <= 24) item.repeats = input.repeats;
  if (typeof input.team === 'string') item.team = input.team.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 100);
  return item;
}
async function appendEvent(req, event) {
  const id = visitorId(req);
  if (!id && event.type !== 'pix_generated') return;
  event.at = Date.now();
  await store.command('EVAL', `
    -- visitor-activity
    ${saveGenerationLua}
    local raw = redis.call('HGET', KEYS[1], ARGV[1])
    if not raw then
      local event = cjson.decode(ARGV[2])
      if event.type == 'pix_generated' then saveGeneration(event, cjson.decode(ARGV[3])) end
      return 0
    end
    local visitor = cjson.decode(raw)
    local event = cjson.decode(ARGV[2])
    local events = visitor.events or {}
    for _, previous in ipairs(events) do
      if previous.id == event.id then return 0 end
    end
    local count = redis.call('INCR', KEYS[3])
    if count == 1 then redis.call('EXPIRE', KEYS[3], 60) end
    if count > 60 then return 0 end
    event.page = visitor.page
    saveGeneration(event, visitor)
    table.insert(events, event)
    while #events > 100 do table.remove(events, 1) end
    visitor.events = events
    if event.type == 'generated_game' then visitor.generatedCount = (visitor.generatedCount or 0) + 1 end
    if event.type == 'pix_generated' then visitor.pixCount = (visitor.pixCount or 0) + 1 end
    visitor.lastSeen = math.max(visitor.lastSeen, event.at)
    redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(visitor))
    redis.call('ZADD', KEYS[2], visitor.lastSeen, ARGV[1])
    return 1
  `, 3, RECORDS, HISTORY, 'visitors:activity-rate:' + (id || 'anonymous'), id || 'anonymous', JSON.stringify(event), JSON.stringify({id:id || 'anonymous', ...location(req)}));
}
async function activity(req, input) {
  if (input.type !== 'generated_game' || typeof input.eventId !== 'string' || !/^[a-f0-9-]{32,36}$/.test(input.eventId)) throw new ApiError(422, 'Atividade inválida.');
  return appendEvent(req, {id:input.eventId, type:'generated_game', item:generatedItem(input.item)});
}
async function recordPix(req, result, items) {
  if (!result.orderId || !Number.isSafeInteger(result.amount) || result.amount < 0) return;
  return appendEvent(req, {id:'pix:' + String(result.orderId).slice(0, 100), type:'pix_generated',
    orderId:String(result.orderId).slice(0, 100), amount:result.amount,
    simulation:result.simulation === true, items:items.slice(0, 30).map(generatedItem)});
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
async function generations(offset = 0) {
  offset = Math.max(0, Math.min(100000000, Number.parseInt(offset, 10) || 0));
  // Import the visitor history already collected before the shared summary existed.
  // HSCAN keeps each request bounded; event IDs make retries safe.
  let cursor = await store.command('GET', IMPORT_CURSOR);
  let importing = cursor !== 'done';
  if (importing) {
    const [next, entries] = await store.command('HSCAN', RECORDS, cursor || '0', 'COUNT', 100);
    const rows = [];
    for (let i = 1; i < entries.length; i += 2) rows.push(JSON.parse(entries[i]));
    await store.command('EVAL', `
      -- visitor-generation-import
      ${saveGenerationLua}
      for _, visitor in ipairs(cjson.decode(ARGV[1])) do
        for _, event in ipairs(visitor.events or {}) do saveGeneration(event, visitor) end
      end
      redis.call('SET', KEYS[1], ARGV[2])
      return 1
    `, 1, IMPORT_CURSOR, JSON.stringify(rows), String(next) === '0' ? 'done' : String(next));
    importing = String(next) !== '0';
  }
  const [keys, totals, total] = await Promise.all([
    store.command('ZREVRANGE', GENERATION_INDEX, offset, offset + 49),
    store.command('HMGET', GENERATION_TOTALS, 'generatedCount', 'pixCount', 'pixAmount', 'simulationCount'),
    store.command('ZCARD', GENERATION_INDEX)
  ]);
  const records = keys.length ? await store.command('HMGET', GENERATIONS, ...keys) : [];
  return {events:records.filter(Boolean).map(record => JSON.parse(record)),
    generatedCount:Number(totals[0] || 0), pixCount:Number(totals[1] || 0), pixAmount:Number(totals[2] || 0), simulationCount:Number(totals[3] || 0),
    total:Number(total), offset, limit:50, importing, updatedAt:Date.now()};
}
async function clear() {
  await store.command('DEL', HISTORY, RECORDS, INDEX);
  return {cleared:true};
}
module.exports = {heartbeat, leave, list, clear, location, activity, recordPix, generatedItem, generations};
