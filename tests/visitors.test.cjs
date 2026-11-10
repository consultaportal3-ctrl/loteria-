'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const store = require('../lib/redis-store.js');
const visitors = require('../lib/visitors.js');
const track = require('../api/visitors.js');
const admin = require('../api/pix-settings.js');
async function request(handler, options = {}) {
  const req = {method:'POST', url:'/api/visitors', headers:{host:'shop.test', origin:'https://shop.test', 'x-forwarded-proto':'https', 'content-type':'application/json', ...options.headers}, body:options.body || {page:'/home.html'}, ...options};
  req.headers = {host:'shop.test', origin:'https://shop.test', 'x-forwarded-proto':'https', 'content-type':'application/json', ...options.headers};
  const headers = {};
  const res = {setHeader:(name, value) => { headers[name] = value; }, end:body => { res.data = JSON.parse(body); }};
  await handler(req, res);
  return {status:res.statusCode, data:res.data, headers};
}
test('visitor history persists offline, paginates and can only be cleared by an authenticated admin with CSRF', async () => {
  const originalCommand = store.command, originalGet = store.get, originalNow = Date.now, originalVercel = process.env.VERCEL;
  const records = new Map(), index = new Map(), rate = new Map(), history = new Map(), saved = new Map();
  let now = 1800000000000;
  Date.now = () => now;
  process.env.VERCEL = '1';
  store.get = async key => records.get(key) || null;
  store.command = async (command, ...args) => {
    if (command === 'EVAL') {
      const [, indexKey, recordKey, rateKey, hashKey, historyKey, cutoff, seen, data, id] = args.slice(1);
      assert.equal(indexKey, 'visitors:online');
      assert.equal(hashKey, 'visitors:records');
      assert.equal(historyKey, 'visitors:history');
      for (const [key, score] of index) if (score <= cutoff) index.delete(key);
      if (!rate.has(rateKey) || rate.get(rateKey) <= now) {
        rate.set(rateKey, now + 20000); records.set(recordKey, JSON.parse(data)); index.set(recordKey, Number(seen));
        saved.set(id, data); history.set(id, Number(seen));
      }
      return 1;
    }
    if (command === 'ZREMRANGEBYSCORE') { for (const [key, score] of index) if (score <= Number(args[2])) index.delete(key); return 1; }
    if (command === 'ZREVRANGE') return [...history].sort((a,b) => b[1] - a[1]).slice(Number(args[1]), Number(args[2]) + 1).map(([key]) => key);
    if (command === 'HMGET') return args.slice(1).map(key => saved.get(key));
    if (command === 'ZCARD') return args[0] === 'visitors:online' ? index.size : history.size;
    if (command === 'DEL') { assert.deepEqual(args, ['visitors:history', 'visitors:records', 'visitors:online']); saved.clear(); history.clear(); index.clear(); return 3; }
    throw Error('Unexpected command ' + command);
  };
  try {
    assert.equal((await request(track, {headers:{origin:'https://other.test'}})).status, 403);
    assert.equal((await request(track, {body:{page:'/home.html?email=private'}})).status, 422);
    assert.equal((await request(track, {body:{page:'/painel.html'}})).status, 422);
    const first = await request(track, {headers:{'x-vercel-ip-city':'S%C3%A3o%20Paulo', 'x-vercel-ip-country-region':'SP', 'x-vercel-ip-country':'BR', 'x-forwarded-for':'192.0.2.1'}});
    assert.equal(first.status, 200);
    assert.match(first.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
    const cookie = first.headers['Set-Cookie'].split(';')[0];
    let result = await visitors.list();
    assert.equal(result.count, 1);
    assert.equal(result.visitors[0].city, 'São Paulo');
    assert.equal(result.visitors[0].online, true);
    assert.equal(result.total, 1);
    assert.equal(JSON.stringify(result).includes('192.0.2.1'), false);
    await request(track, {headers:{cookie}, body:{page:'/carrinho.html'}});
    assert.equal((await visitors.list()).visitors[0].page, '/home.html', 'rapid duplicate is throttled');
    now += 30000;
    await request(track, {headers:{cookie}, body:{page:'/carrinho.html'}});
    result = await visitors.list();
    assert.equal(result.count, 1, 'navigation keeps the same visitor');
    assert.equal(result.visitors[0].page, '/carrinho.html');
    assert.equal((await request(admin, {method:'GET', url:'/api/pix-settings?action=visitors'})).status, 401);
    const token = 'a'.repeat(64), sessionKey = 'directpix:session:' + createHash('sha256').update(token).digest('hex');
    records.set(sessionKey, {authenticated:false, csrf:'test-csrf'});
    assert.equal((await request(admin, {method:'GET', url:'/api/pix-settings?action=visitors', headers:{cookie:'pix_admin=' + token}})).status, 401);
    assert.equal((await request(admin, {headers:{cookie:'pix_admin=' + token}, body:{action:'clear-visitors', csrf:'test-csrf', confirm:true}})).status, 401);
    records.set(sessionKey, {authenticated:true, csrf:'test-csrf'});
    const protectedList = await request(admin, {method:'GET', url:'/api/pix-settings?action=visitors', headers:{cookie:'pix_admin=' + token}});
    assert.equal(protectedList.status, 200);
    assert.equal(protectedList.headers['Cache-Control'], 'no-store');
    assert.equal(protectedList.data.count, 1);
    now += 90001;
    result = await visitors.list();
    assert.equal(result.count, 0);
    assert.equal(result.total, 1);
    assert.equal(result.visitors.length, 1, 'offline visit must remain saved');
    assert.equal(result.visitors[0].online, false);
    now += 86400000 * 30;
    assert.equal((await visitors.list()).total, 1, 'history has no automatic expiration');
    for (let i = 0; i < 105; i++) { history.set('fixture-' + i, now + i); saved.set('fixture-' + i, JSON.stringify({id:'fixture-' + i, lastSeen:now + i, page:'/home.html'})); }
    assert.equal((await visitors.list()).visitors.length, 100);
    assert.equal((await visitors.list(100)).visitors.length, 6);
    const clearRequest = body => request(admin, {headers:{cookie:'pix_admin=' + token}, body:{action:'clear-visitors', ...body}});
    assert.equal((await clearRequest({csrf:'wrong', confirm:true})).status, 403);
    assert.equal((await clearRequest({csrf:'test-csrf'})).status, 422);
    assert.equal((await visitors.list()).total, 106);
    assert.equal((await clearRequest({csrf:'test-csrf', confirm:true})).status, 200);
    assert.equal((await visitors.list()).total, 0);
    await request(track, {headers:{cookie}});
    assert.equal((await visitors.list()).total, 1, 'active visitor reappears after manual clearing');
    delete process.env.VERCEL;
    assert.equal(visitors.location({headers:{'x-vercel-ip-city':'Forged'}}).city, '');
    process.env.VERCEL = '1';
    assert.equal(visitors.location({headers:{'x-vercel-ip-city':'%broken'}}).city, '');
  } finally {
    store.command = originalCommand; store.get = originalGet; Date.now = originalNow;
    if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel;
  }
});
