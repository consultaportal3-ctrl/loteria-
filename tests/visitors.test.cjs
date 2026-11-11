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
  const records = new Map(), index = new Map(), rate = new Map(), history = new Map(), saved = new Map(), tabs = new Map(), closed = new Map();
  const generations = new Map(), generationScores = new Map(), generationTotals = {generatedCount:0,pixCount:0,pixAmount:0,simulationCount:0};
  let importCursor = null;
  function saveGeneration(event, visitor) {
    if (!['generated_game','pix_generated'].includes(event.type) || !event.id) return;
    const key = event.type === 'pix_generated' ? event.id : visitor.id + ':' + event.id;
    if (generations.has(key)) return;
    generations.set(key, JSON.stringify({...event, visitorId:visitor.id,city:visitor.city})); generationScores.set(key,event.at);
    if (event.type === 'generated_game') generationTotals.generatedCount++;
    else { generationTotals.pixCount++; if (event.simulation) generationTotals.simulationCount++; else generationTotals.pixAmount += event.amount; }
  }
  let now = 1800000000000;
  Date.now = () => now;
  process.env.VERCEL = '1';
  store.get = async key => records.get(key) || null;
  store.command = async (command, ...args) => {
    if (command === 'EVAL') {
      if (args[0].includes('visitor-generation-import')) {
        const [, key, data, cursor] = args.slice(1);
        for (const visitor of JSON.parse(data)) for (const event of visitor.events || []) saveGeneration(event,visitor);
        importCursor = cursor; return 1;
      }
      if (args[0].includes('visitor-activity')) {
        const [, hashKey, historyKey, rateKey, id, data, fallback] = args.slice(1);
        assert.equal(hashKey, 'visitors:records'); assert.equal(historyKey, 'visitors:history');
        if (!saved.has(id)) { const event = JSON.parse(data); if(event.type === 'pix_generated')saveGeneration(event,JSON.parse(fallback)); return 0; }
        const visitor = JSON.parse(saved.get(id)), event = JSON.parse(data);
        visitor.events ||= [];
        if (visitor.events.some(previous => previous.id === event.id)) return 0;
        event.page = visitor.page; saveGeneration(event,visitor); visitor.events.push(event); visitor.events = visitor.events.slice(-100);
        if (event.type === 'generated_game') visitor.generatedCount = (visitor.generatedCount || 0) + 1;
        if (event.type === 'pix_generated') visitor.pixCount = (visitor.pixCount || 0) + 1;
        visitor.lastSeen = Math.max(visitor.lastSeen, event.at);
        saved.set(id, JSON.stringify(visitor)); history.set(id, visitor.lastSeen);
        return 1;
      }
      if (args[0].includes('visitor-leave')) {
        const [, indexKey, tabsKey, closedKey, tab, cutoff, recordKey] = args.slice(1);
        closed.set(closedKey, now + 180000);
        const active = tabs.get(tabsKey) || new Map();
        active.delete(tab);
        for (const [key, score] of active) if (score <= cutoff) active.delete(key);
        if (!active.size) index.delete(recordKey);
        else if (index.has(recordKey)) index.set(recordKey, Math.max(...active.values()));
        return 1;
      }
      const [, indexKey, recordKey, rateKey, hashKey, historyKey, tabsKey, closedKey, cutoff, seen, data, id, tab] = args.slice(1);
      if ((closed.get(closedKey) || 0) > now) return 0;
      assert.equal(indexKey, 'visitors:online');
      assert.equal(hashKey, 'visitors:records');
      assert.equal(historyKey, 'visitors:history');
      for (const [key, score] of index) if (score <= cutoff) index.delete(key);
      const incoming = JSON.parse(data), prior = saved.has(id) ? JSON.parse(saved.get(id)) : {};
      if (!rate.has(rateKey) || rate.get(rateKey) <= now || (tab !== 'legacy' && prior.page !== incoming.page)) {
        incoming.firstSeen = prior.firstSeen || incoming.lastSeen;
        incoming.events = prior.events || [];
        incoming.generatedCount = prior.generatedCount || 0; incoming.pixCount = prior.pixCount || 0;
        if (prior.page !== incoming.page) incoming.events.push({type:'page',page:incoming.page,at:incoming.lastSeen});
        incoming.events = incoming.events.slice(-100);
        const encoded = JSON.stringify(incoming);
        const active = tabs.get(tabsKey) || new Map();
        for (const [key, score] of active) if (score <= cutoff) active.delete(key);
        active.set(tab, Number(seen)); tabs.set(tabsKey, active);
        rate.set(rateKey, now + 20000); records.set(recordKey, incoming); index.set(recordKey, Number(seen));
        saved.set(id, encoded); history.set(id, Number(seen));
      }
      return 1;
    }
    if (command === 'ZREMRANGEBYSCORE') { for (const [key, score] of index) if (score <= Number(args[2])) index.delete(key); return 1; }
    if (command === 'GET') { assert.equal(args[0], 'visitors:generation-import'); return importCursor; }
    if (command === 'HSCAN') return ['0',[...saved].flat()];
    if (command === 'ZREVRANGE') return [...(args[0] === 'visitors:generation-index' ? generationScores : history)].sort((a,b) => b[1] - a[1]).slice(Number(args[1]), Number(args[2]) + 1).map(([key]) => key);
    if (command === 'HMGET') {
      if(args[0] === 'visitors:generation-totals')return args.slice(1).map(key=>String(generationTotals[key]));
      return args.slice(1).map(key => (args[0] === 'visitors:generations' ? generations : saved).get(key));
    }
    if (command === 'ZMSCORE') return args.slice(1).map(key => index.has(key) ? String(index.get(key)) : null);
    if (command === 'ZCARD') return args[0] === 'visitors:online' ? index.size : args[0] === 'visitors:generation-index' ? generations.size : history.size;
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
    const tabA = 'a'.repeat(32), tabB = 'b'.repeat(32);
    now += 90001;
    await request(track, {headers:{cookie}, body:{page:'/home.html', tabId:tabA}});
    await request(track, {headers:{cookie}, body:{page:'/carrinho.html', tabId:tabB}});
    assert.equal((await visitors.list()).count, 1);
    await request(track, {headers:{cookie}, body:{action:'leave', tabId:tabA}});
    assert.equal((await visitors.list()).count, 1, 'another tab keeps the visitor online');
    await request(track, {headers:{cookie}, body:{action:'leave', tabId:tabB}});
    result = await visitors.list();
    assert.equal(result.count, 0, 'closing last tab immediately removes online status');
    assert.equal(result.visitors[0].online, false);
    assert.equal(result.total, 1, 'leaving preserves visit history');
    await request(track, {headers:{cookie}, body:{page:'/home.html', tabId:tabB}});
    assert.equal((await visitors.list()).count, 0, 'late heartbeat cannot resurrect a closed tab');
    await request(track, {headers:{cookie}, body:{page:'/home.html', tabId:'c'.repeat(32)}});
    assert.equal((await visitors.list()).count, 1, 'returning to the site goes online');
    const tabC = 'c'.repeat(32);
    await request(track, {headers:{cookie}, body:{page:'/home.html#mega-sena', tabId:tabC}});
    await request(track, {headers:{cookie}, body:{page:'/home.html#combos', tabId:tabC}});
    let visitor = (await visitors.list()).visitors[0];
    assert.equal(visitor.page, '/home.html#combos', 'route changes are recorded immediately');
    assert.deepEqual(visitor.events.slice(-2).map(event => event.page), ['/home.html#mega-sena','/home.html#combos']);
    const generated = {action:'activity',type:'generated_game',eventId:'d'.repeat(32),item:{game:'mega',numbers:[1,2,3,4,5,6],contest:3085,repeats:1,email:'must-not-be-saved',cpf:'must-not-be-saved'}};
    assert.equal((await request(track, {headers:{cookie},body:generated})).status, 200);
    await request(track, {headers:{cookie},body:generated});
    visitor = (await visitors.list()).visitors[0];
    assert.equal(visitor.generatedCount, 1, 'event retries do not duplicate generations');
    assert.deepEqual(visitor.events.at(-1).item.numbers, [1,2,3,4,5,6]);
    assert.equal(JSON.stringify(visitor).includes('must-not-be-saved'), false);
    assert.equal((await request(track, {headers:{cookie},body:{...generated,type:'pix_generated'}})).status, 422, 'browser cannot claim a PIX was generated');
    assert.equal((await request(track, {headers:{cookie},body:{...generated,item:{game:'mega',numbers:Array(51).fill(1)}}})).status, 422);
    assert.equal((await request(track, {headers:{cookie},body:{page:'/home.html#checkout?email=private',tabId:tabC}})).status, 422);
    await visitors.recordPix({headers:{cookie}}, {orderId:'ORDER-TEST',amount:600,simulation:false}, [generated.item]);
    await visitors.recordPix({headers:{cookie}}, {orderId:'ORDER-TEST',amount:600,simulation:false}, [generated.item]);
    visitor = (await visitors.list()).visitors[0];
    assert.equal(visitor.pixCount, 1); assert.equal(visitor.events.at(-1).amount, 600);
    assert.equal(visitor.events.at(-1).type, 'pix_generated');
    now += 30000;
    await request(track, {headers:{cookie},body:{page:'/carrinho.html',tabId:tabC}});
    visitor = (await visitors.list()).visitors[0];
    assert.equal(visitor.generatedCount, 1, 'heartbeat preserves generated counts');
    assert.equal(visitor.pixCount, 1); assert(visitor.events.some(event => event.type === 'generated_game'));
    for (let i=0;i<110;i++) await request(track, {headers:{cookie},body:{page:'/home.html#route-'+i,tabId:tabC}});
    assert.equal((await visitors.list()).visitors[0].events.length, 100, 'timeline remains bounded');
    saved.set('older-visitor', JSON.stringify({id:'older-visitor',events:[{id:'old-generation',type:'generated_game',at:now-1000,item:{game:'quina',numbers:[1,2,3,4,5]}},{id:'old-pix',type:'pix_generated',amount:900,simulation:true,at:now-500,orderId:'SIM-OLD'}]}));
    let shared = await visitors.generations();
    assert.equal(shared.generatedCount,2,'imports older visitors and retains generations evicted from visitor timelines');
    assert.equal(shared.pixCount,2); assert.equal(shared.pixAmount,600,'simulation amount excluded from real PIX amount'); assert.equal(shared.simulationCount,1);
    assert.equal(shared.total,4); assert.equal(shared.importing,false);
    shared = await visitors.generations(); assert.equal(shared.total,4,'repeated summary reads do not duplicate imports');
    assert.equal((await request(admin,{method:'GET',url:'/api/pix-settings?action=generations'})).status,401,'shared generations require login');
    assert.equal((await request(admin,{method:'GET',url:'/api/pix-settings?action=generations',headers:{cookie:'pix_admin='+token}})).data.total,4);
    for(let i=0;i<55;i++){now++;await request(track,{headers:{cookie},body:{...generated,eventId:(i+100).toString(16).padStart(32,'0')}});}
    shared=await visitors.generations(); assert.equal(shared.events.length,50); assert.equal(shared.total,59);
    assert.equal((await visitors.generations(50)).events.length,9,'shared feed is paginated');
    await visitors.recordPix({headers:{}},{orderId:'NO-VISITOR',amount:350,simulation:false},[generated.item]);
    shared=await visitors.generations();assert.equal(shared.pixCount,3);assert.equal(shared.pixAmount,950,'successful PIX is included even without a tracking cookie');
    await visitors.recordPix({headers:{cookie}},{orderId:'NO-VISITOR',amount:350,simulation:false},[generated.item]);
    assert.equal((await visitors.generations()).pixCount,3,'the same order cannot be counted twice when visitor identification changes');
    delete process.env.VERCEL;
    assert.equal(visitors.location({headers:{'x-vercel-ip-city':'Forged'}}).city, '');
    process.env.VERCEL = '1';
    assert.equal(visitors.location({headers:{'x-vercel-ip-city':'%broken'}}).city, '');
  } finally {
    store.command = originalCommand; store.get = originalGet; Date.now = originalNow;
    if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel;
  }
});
