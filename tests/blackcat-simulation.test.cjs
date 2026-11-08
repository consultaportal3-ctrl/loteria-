'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sim = require('../lib/blackcat-simulation.cjs');
const handler = require('../api/blackcat-simulation.js');
const mega = {game:'mega',numbers:[1,2,3,4,5,6],referencePrice:0.01};
const buyer = {name:'Cliente Teste',email:'cliente@example.invalid'};
const env = {BLACKCAT_MODE:'simulation'};
const now = 1800000000000;
const sequence = n => Array.from({length:n},(_,i) => i + 1);

test('production cannot be enabled by changing mode', () => {
  for (const mode of ['live','production','test']) assert.throws(() => sim.info({BLACKCAT_MODE:mode}),e => e.status === 503);
});

test('production deployment cannot generate simulated payment codes', () => {
  assert.throws(() => sim.info({VERCEL_ENV:'production', BLACKCAT_MODE:'simulation'}), error => error.status === 503);
  assert.throws(() => sim.createSimulation({buyer, items:[mega]}, {VERCEL_ENV:'production', BLACKCAT_MODE:'simulation'}, now), error => error.status === 503);
});
test('server ignores browser prices and recalculates combinations and repeats', () => {
  assert.equal(sim.priceItems([mega]).amount,600);
  assert.equal(sim.priceItems([{...mega,numbers:sequence(8)}]).amount,16800);
  assert.equal(sim.priceItems([{...mega,repeats:3}]).amount,1800);
  assert.equal(sim.priceItems([{...mega,special:'virada',repeats:3}]).amount,600);
});
test('server prices all supported modalities', () => {
  const cases = [
    [{game:'facil',numbers:sequence(15)},350], [{game:'quina',numbers:sequence(5)},300],
    [{game:'milionaria',numbers:sequence(6),trevos:[1,2,3]},1800],
    [{game:'mania',numbers:Array.from({length:50},(_,i) => i)},300],
    [{game:'timemania',numbers:sequence(10),team:'Time de teste'},350],
    [{game:'dupla',numbers:sequence(6)},300], [{game:'dia',numbers:sequence(7),month:0},250],
    [{game:'super',columns:Array.from({length:7},() => [0])},300],
    [{game:'loteca',picks:[3,...Array(13).fill(1)]},400],
  ];
  for (const [item,price] of cases) assert.equal(sim.priceItems([item]).amount,price,item.game);
});
test('malformed combinations and oversized totals are rejected', () => {
  for (const item of [{...mega,numbers:[1,1,2,3,4,5]}, {...mega,repeats:-1}, {...mega,game:'__proto__'},
    {game:'dia',numbers:sequence(7),month:12}, {game:'super',columns:Array(7).fill([1,1])},
    {...mega,numbers:sequence(20),repeats:12}]) assert.throws(() => sim.priceItems([item]));
  assert.throws(() => sim.priceItems([]));
  assert.throws(() => sim.priceItems(Array(31).fill(mega)));
});
test('BlackCat fixture contains documented fields and no submitted buyer data', () => {
  const fixture = sim.requestFixture([mega],'SIM-fixture');
  assert.equal(fixture.paymentMethod,'pix');
  assert.equal(fixture.items[0].unitPrice,600);
  assert.equal(fixture.items[0].title,'Vasco PG');
  assert.equal(fixture.customer.document.type,'cpf');
  const result = sim.createSimulation({buyer,items:[mega]},env,now);
  assert.equal(result.simulation,true);
  assert.equal(result.gatewayFixture.data.status,'PENDING');
  assert.equal(result.gatewayFixture.data.amount,600);
  assert.equal(result.qrCode.startsWith('SIMULACAO-SEM-VALOR:'),true);
  assert.equal(JSON.stringify(result).includes(buyer.email),false);
  assert.equal(decodeURIComponent(result.orderToken).includes(buyer.name),false);
});
test('simulated success is never a real approved payment and expires', () => {
  const created = sim.createSimulation({buyer,items:[mega]},env,now);
  assert.equal(sim.simulationStatus(created.orderToken,env,now).status,'simulated_pending');
  assert.equal(sim.simulationStatus(created.orderToken,env,now+15000).status,'simulated_paid');
  assert.equal(sim.simulationStatus(created.orderToken,env,now+600000).status,'simulated_expired');
});
test('all terminal scenarios remain explicitly simulated', () => {
  for (const scenario of ['cancelled','expired','rejected','pending']) {
    const settings = {...env,BLACKCAT_SIMULATION_SCENARIO:scenario};
    const created = sim.createSimulation({buyer,items:[mega]},settings,now);
    assert.equal(sim.simulationStatus(created.orderToken,settings,now+20000).status,`simulated_${scenario}`);
  }
});
test('invalid fixtures, configuration and buyer data fail closed', () => {
  for (const token of ['', 'REAL-token', 'SIM.%', 'SIM.null', 'SIM.'+encodeURIComponent('{}')]) {
    assert.throws(() => sim.simulationStatus(token,env,now),e => e.status === 404);
  }
  assert.throws(() => sim.config({...env,BLACKCAT_SIMULATION_SCENARIO:'approved'}));
  assert.throws(() => sim.config({...env,BLACKCAT_SIMULATION_DELAY_SECONDS:'-1'}));
  assert.throws(() => sim.createSimulation({buyer:{name:'A',email:'invalid'},items:[mega]},env,now));
});
async function request(action, options = {}) {
  const req = {url:`/api/blackcat-simulation?action=${action}`,method:options.method || 'GET',
    headers:{host:'example.test',origin:'https://example.test','content-type':'application/json',...options.headers},body:options.body};
  let data;
  const headers = {};
  const res = {statusCode:200,setHeader(name,value) { headers[name] = value; },end(text) { data = JSON.parse(text); }};
  await handler(req,res);
  return {status:res.statusCode,data,headers};
}
test('API rejects cross-origin requests, wrong methods and invalid JSON', async () => {
  assert.equal((await request('create-payment')).status,405);
  assert.equal((await request('create-payment',{method:'POST',headers:{origin:'https://evil.test'}})).status,403);
  assert.equal((await request('create-payment',{method:'POST',headers:{origin:''}})).status,403);
  assert.equal((await request('create-payment',{method:'POST',headers:{'content-type':'text/plain'}})).status,415);
  assert.equal((await request('create-payment',{method:'POST',body:'{'})).status,400);
  assert.equal((await request('create-payment',{method:'POST',body:'x'.repeat(65537)})).status,413);
});
test('API provides simulation-only uncached responses', async () => {
  const result = await request('create-payment',{method:'POST',body:{buyer,items:[mega]}});
  assert.equal(result.status,201);
  assert.equal(result.data.environment,'simulation');
  assert.equal(result.headers['Cache-Control'],'no-store');
  assert.equal((await request('checkout-info')).data.simulation,true);
  assert.equal((await request('business-info')).data.simulation,true);
  assert.equal((await request('unknown')).status,404);
});
test('API status accepts the browser URL-encoded fixture and rejects real tokens', async () => {
  const created = await request('create-payment',{method:'POST',body:JSON.stringify({buyer,items:[mega]})});
  assert.equal(created.status,201);
  const status = await request('payment-status&token='+encodeURIComponent(created.data.orderToken));
  assert.equal(status.status,200);
  assert.equal(status.data.simulation,true);
  assert.equal(status.data.status.startsWith('simulated_'),true);
  assert.equal((await request('payment-status&token=real-payment-token')).status,404);
});
