'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createMockHandlers,signature,targetUrl}=require('../lib/mock-webhooks.cjs');
const {createSimulation}=require('../lib/blackcat-simulation.cjs');
const now=1800000000000;
const env={NODE_ENV:'development',BLACKCAT_MODE:'simulation',MOCK_ENABLED:'true',MOCK_BASE_URL:'http://127.0.0.1:3000',
  MOCK_WEBHOOK_SECRET:'a'.repeat(64),MOCK_TRIGGER_SECRET:'b'.repeat(64)};
const fixture=()=>createSimulation({buyer:{name:'Cliente Teste',email:'cliente@example.invalid'},items:[{game:'mega',numbers:[1,2,3,4,5,6]}]},env,now);
function event(){const transaction=fixture();return {id:'MOCK-EVT-12345678-1234-4234-8234-123456789abc',type:'mock.transaction.updated',transactionId:transaction.orderId,
  orderToken:transaction.orderToken,amount:transaction.amount,status:'paid',simulated:true,createdAt:new Date(now).toISOString()};}
async function call(handler,body={},headers={},method='POST'){
  const req={method,body,headers:{'content-type':'application/json',...headers}};
  let data;const outputHeaders={};
  const res={statusCode:200,setHeader(k,v){outputHeaders[k]=v;},end(value){data=JSON.parse(value);}};
  await handler(req,res);return {status:res.statusCode,data,headers:outputHeaders};
}
const make=(overrides={})=>createMockHandlers({env,clock:()=>now,...overrides});
test('disabled, missing environment and production always return 404',async()=>{
  for(const configuration of [{...env,MOCK_ENABLED:'false'},{...env,VERCEL_ENV:'production'},
    {...env,NODE_ENV:'production'}, {...env,NODE_ENV:undefined}]){
    const handlers=make({env:configuration});
    assert.equal((await call(handlers.sender)).status,404);
    assert.equal((await call(handlers.receiver)).status,404);
  }
});
test('missing, identical and live gateway secrets cannot configure mocks',async()=>{
  for(const secret of ['',env.MOCK_TRIGGER_SECRET,'sk_live_'+'x'.repeat(40)]){
    assert.equal((await call(make({env:{...env,MOCK_WEBHOOK_SECRET:secret}}).sender)).status,503);
  }
});
test('sender requires its separate operator credential and POST',async()=>{
  let sent=false;const handlers=make({transport:()=>{sent=true;}});
  assert.equal((await call(handlers.sender)).status,401);
  assert.equal((await call(handlers.sender,{}, {authorization:`Bearer ${env.MOCK_WEBHOOK_SECRET}`})).status,401);
  const result=await call(handlers.sender,{}, {},'GET');
  assert.equal(result.status,405);assert.equal(result.headers.Allow,'POST');assert.equal(sent,false);
});
test('receiver verifies HMAC, simulated flag, timestamp, status and order identity',async()=>{
  const receiver=make().receiver;const original=event();
  assert.equal((await call(receiver,original,{'x-mock-signature':'invalid'})).status,401);
  const modified={...original,amount:1};
  assert.equal((await call(receiver,modified,{'x-mock-signature':signature(original,env.MOCK_WEBHOOK_SECRET)})).status,401);
  for(const patch of [{simulated:false},{status:'approved'},{createdAt:new Date(now-301000).toISOString()}]){
    const body={...original,...patch};
    assert.equal((await call(receiver,body,{'x-mock-signature':signature(body,env.MOCK_WEBHOOK_SECRET)})).status,400);
  }
  const mismatched={...original,transactionId:'REAL-payment'};
  assert.equal((await call(receiver,mismatched,{'x-mock-signature':signature(mismatched,env.MOCK_WEBHOOK_SECRET)})).status,409);
});
test('repeated events acknowledge the same simulation without changing financial state',async()=>{
  const body=event();const headers={'x-mock-signature':signature(body,env.MOCK_WEBHOOK_SECRET)};
  const receiver=make().receiver;
  const first=await call(receiver,body,headers);const repeated=await call(receiver,body,headers);
  assert.equal(first.status,200);assert.equal(first.data.status,'simulated_paid');
  assert.deepEqual(first.data,repeated.data);assert.equal(first.headers['Cache-Control'],'no-store');
});
test('mock target is restricted to the local or exact preview receiver',()=>{
  assert.equal(targetUrl(env,false),'http://127.0.0.1:3000/api/mock-webhook');
  for(const target of ['https://api.blackcatoficial.com/api','http://169.254.169.254/latest','http://127.0.0.1:3000/api/admin.php',
    'http://user:pass@127.0.0.1:3000/api/mock-webhook','http://127.0.0.1:3000/api/mock-webhook?redirect=1']){
    assert.throws(()=>targetUrl({...env,MOCK_WEBHOOK_TARGET:target},false));
  }
  assert.equal(targetUrl({...env,VERCEL_URL:'study.vercel.app'},true),'https://study.vercel.app/api/mock-webhook');
});
test('invalid JSON, oversized events and foreign tokens are rejected',async()=>{
  const handlers=make();const auth={authorization:`Bearer ${env.MOCK_TRIGGER_SECRET}`};
  assert.equal((await call(handlers.sender,'{',auth)).status,400);
  assert.equal((await call(handlers.sender,'x'.repeat(16385),auth)).status,413);
  assert.equal((await call(handlers.sender,{}, {...auth,'content-type':'text/plain'})).status,415);
  assert.equal((await call(handlers.sender,{orderToken:'real-token'},auth)).status,404);
});
test('failed delivery does not return success or expose receiver response bodies',async()=>{
  const input={orderToken:fixture().orderToken};const auth={authorization:`Bearer ${env.MOCK_TRIGGER_SECRET}`};
  for(const transport of [async()=>{throw new Error('private details');},async()=>({ok:false,status:500}),
    async()=>({ok:true,status:200,json:async()=>({received:true,simulated:false})})]){
    const result=await call(make({transport}).sender,input,auth);
    assert.equal(result.status,502);assert.equal(JSON.stringify(result).includes('private details'),false);
  }
});
test('native HTTP sender and receiver complete a signed simulation round trip',async()=>{
  const configuration={...env};const handlers=make({env:configuration});
  const server=http.createServer((req,res)=>{
    if(req.url==='/api/mock-webhook')return handlers.receiver(req,res);
    if(req.url==='/api/mock-send-webhook')return handlers.sender(req,res);
    res.writeHead(404).end();
  });
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    configuration.MOCK_BASE_URL=`http://127.0.0.1:${server.address().port}`;
    const response=await fetch(configuration.MOCK_BASE_URL+'/api/mock-send-webhook',{
      method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${configuration.MOCK_TRIGGER_SECRET}`},
      body:JSON.stringify({orderToken:fixture().orderToken,status:'paid'})});
    const result=await response.json();
    assert.equal(response.status,200);assert.equal(result.webhookStatus,200);assert.equal(result.simulated,true);
    assert.equal(result.status,'simulated_paid');assert.equal(result.transactionId.startsWith('SIM-'),true);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
