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
test('presence is anonymous, expires, validates origin and requires admin login to list cities', async () => {
  const originalCommand = store.command, originalGet = store.get, originalNow = Date.now, originalVercel = process.env.VERCEL;
  const records = new Map(), index = new Map(), rate = new Map();
  let now = 1800000000000;
  Date.now = () => now;
  process.env.VERCEL = '1';
  store.get = async key => records.get(key) || null;
  store.command = async (command, ...args) => {
    if (command === 'EVAL') {
      const [, indexKey, recordKey, rateKey, cutoff, seen, data] = args.slice(1);
      assert.equal(indexKey, 'visitors:online');
      for (const [key, score] of index) if (score <= cutoff) index.delete(key);
      if (!rate.has(rateKey) || rate.get(rateKey) <= now) {
        rate.set(rateKey, now + 20000); records.set(recordKey, JSON.parse(data)); index.set(recordKey, Number(seen));
      }
      return 1;
    }
    if (command === 'ZREMRANGEBYSCORE') { for (const [key, score] of index) if (score <= Number(args[2])) index.delete(key); return 1; }
    if (command === 'ZREVRANGE') return [...index].sort((a,b) => b[1] - a[1]).slice(0, 500).map(([key]) => key);
    if (command === 'MGET') return args.map(key => JSON.stringify(records.get(key)));
    if (command === 'ZCARD') return index.size;
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
    records.set(sessionKey, {authenticated:false});
    assert.equal((await request(admin, {method:'GET', url:'/api/pix-settings?action=visitors', headers:{cookie:'pix_admin=' + token}})).status, 401);
    records.set(sessionKey, {authenticated:true});
    const protectedList = await request(admin, {method:'GET', url:'/api/pix-settings?action=visitors', headers:{cookie:'pix_admin=' + token}});
    assert.equal(protectedList.status, 200);
    assert.equal(protectedList.headers['Cache-Control'], 'no-store');
    assert.equal(protectedList.data.count, 1);
    now += 90001;
    assert.equal((await visitors.list()).count, 0);
    delete process.env.VERCEL;
    assert.equal(visitors.location({headers:{'x-vercel-ip-city':'Forged'}}).city, '');
    process.env.VERCEL = '1';
    assert.equal(visitors.location({headers:{'x-vercel-ip-city':'%broken'}}).city, '');
  } finally {
    store.command = originalCommand; store.get = originalGet; Date.now = originalNow;
    if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel;
  }
});
