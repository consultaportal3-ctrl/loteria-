'use strict';
// Runs an isolated HTTP round trip on loopback; no external gateway is contacted.
const http = require('node:http');
const {randomBytes} = require('node:crypto');
const {createMockHandlers} = require('../lib/mock-webhooks.cjs');
const {createSimulation} = require('../lib/blackcat-simulation.cjs');
const env={NODE_ENV:'development',BLACKCAT_MODE:'simulation',MOCK_ENABLED:'true',
  MOCK_WEBHOOK_SECRET:randomBytes(32).toString('hex'),MOCK_TRIGGER_SECRET:randomBytes(32).toString('hex')};
const handlers=createMockHandlers({env});
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/api/mock-webhook')return handlers.receiver(req,res);
  if(pathname==='/api/mock-send-webhook')return handlers.sender(req,res);
  res.writeHead(404).end();
});
(async()=>{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  env.MOCK_BASE_URL=`http://127.0.0.1:${server.address().port}`;
  const transaction=createSimulation({buyer:{name:'Cliente Teste',email:'cliente@example.invalid'},
    items:[{game:'mega',numbers:[1,2,3,4,5,6]}]},env);
  const response=await fetch(env.MOCK_BASE_URL+'/api/mock-send-webhook',{
    method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${env.MOCK_TRIGGER_SECRET}`},
    body:JSON.stringify({orderToken:transaction.orderToken,status:'paid'})});
  const result=await response.json();
  if(!response.ok || result.simulated!==true || result.status!=='simulated_paid')throw new Error('Mock round trip failed.');
  console.log(JSON.stringify(result,null,2));
  console.log('OK: HTTP local -> assinatura HMAC -> webhook -> resultado simulado. Nenhuma cobranca real.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>server.close());
