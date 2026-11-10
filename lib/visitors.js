'use strict';
const {randomBytes} = require('node:crypto');
const {ApiError, env} = require('./api-bootstrap.js');
const store = require('./redis-store.js');
const WINDOW = 90000;
const INDEX = 'visitors:online';
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
  const id = /(?:^|;\s*)site_visitor=([a-f0-9]{32})(?:;|$)/.exec(req.headers.cookie || '')?.[1] || randomBytes(16).toString('hex');
  const now = Date.now();
  const visitor = {id, ...location(req), page:input.page, lastSeen:now};
  await store.command('EVAL', `
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
    if redis.call('SET', KEYS[3], '1', 'NX', 'EX', 20) then
      redis.call('SET', KEYS[2], ARGV[3], 'EX', 90)
      redis.call('ZADD', KEYS[1], ARGV[2], KEYS[2])
      redis.call('EXPIRE', KEYS[1], 180)
    end
    return 1
  `, 3, INDEX, 'visitors:session:' + id, 'visitors:rate:' + id, now - WINDOW, now, JSON.stringify(visitor));
  res.setHeader('Set-Cookie', `site_visitor=${id}; Path=/; HttpOnly; Secure; SameSite=Lax`);
}
async function list() {
  const now = Date.now();
  await store.command('ZREMRANGEBYSCORE', INDEX, '-inf', now - WINDOW);
  const keys = await store.command('ZREVRANGE', INDEX, 0, 499);
  const records = keys.length ? await store.command('MGET', ...keys) : [];
  const visitors = records.filter(Boolean).map(record => JSON.parse(record)).filter(row => row.lastSeen > now - WINDOW);
  const count = Number(await store.command('ZCARD', INDEX));
  return {visitors, count, windowSeconds:90, updatedAt:now};
}
module.exports = {heartbeat, list, location};
