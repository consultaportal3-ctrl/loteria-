'use strict';
// Study-only webhooks. No gateway credentials, financial orders, or real payments.
const {createHmac,randomUUID,timingSafeEqual} = require('node:crypto');
const simulation = require('./blackcat-simulation.cjs');
const STATES = ['pending','paid','cancelled','expired','rejected'];
class MockError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
function settings(env) {
  const preview = env.VERCEL_ENV === 'preview';
  const development = env.VERCEL_ENV === 'development' || (!env.VERCEL_ENV && env.NODE_ENV === 'development');
  if (env.MOCK_ENABLED !== 'true' || (!preview && !development)) throw new MockError('Not found',404);
  simulation.requireSimulation(env);
  const secret=env.MOCK_WEBHOOK_SECRET;
  const trigger=env.MOCK_TRIGGER_SECRET;
  if (typeof secret!=='string' || secret.length<32 || typeof trigger!=='string' || trigger.length<32
    || secret===trigger || /^(sk_live_|pk_live_)/.test(secret) || /^(sk_live_|pk_live_)/.test(trigger)) {
    throw new MockError('Configure dois segredos de teste diferentes, com pelo menos 32 caracteres.',503);
  }
  return {secret,trigger,preview};
}
function sameSecret(actual,expected) {
  if(typeof actual!=='string')return false;
  const a=Buffer.from(actual),b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
function signature(event,secret) {
  return createHmac('sha256',secret).update(JSON.stringify(event)).digest('hex');
}
function targetUrl(env,preview) {
  let base,target;
  try {
    base=new URL(preview ? `https://${env.VERCEL_URL || ''}` : env.MOCK_BASE_URL);
    target=new URL(env.MOCK_WEBHOOK_TARGET || '/api/mock-webhook',base);
  } catch {throw new MockError('Configure o endereço do ambiente de estudo.',503);}
  const local=['127.0.0.1','localhost','[::1]'].includes(base.hostname);
  if ((preview && base.protocol!=='https:') || (!preview && (!local || base.protocol!=='http:'))
    || target.origin!==base.origin || target.pathname!=='/api/mock-webhook' || target.search || target.hash
    || target.username || target.password || base.username || base.password) {
    throw new MockError('O destino deve ser o webhook do próprio preview ou do servidor local.',503);
  }
  return target.href;
}
async function jsonBody(req) {
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))throw new MockError('Envie JSON.',415);
  if(Number(req.headers['content-length'] || 0)>16384)throw new MockError('Evento muito grande.',413);
  let body=req.body;
  if(body===undefined){
    const chunks=[];let size=0;
    for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>16384)throw new MockError('Evento muito grande.',413);chunks.push(Buffer.from(chunk));}
    body=Buffer.concat(chunks).toString('utf8');
  }
  if(Buffer.isBuffer(body))body=body.toString('utf8');
  if(typeof body==='string'){
    if(Buffer.byteLength(body)>16384)throw new MockError('Evento muito grande.',413);
    try{body=JSON.parse(body);}catch{throw new MockError('JSON inválido.');}
  }
  if(!body || typeof body!=='object' || Array.isArray(body))throw new MockError('Evento inválido.');
  if(Buffer.byteLength(JSON.stringify(body))>16384)throw new MockError('Evento muito grande.',413);
  return body;
}
function validateEvent(event,env,now) {
  if(event.simulated!==true || event.type!=='mock.transaction.updated'
    || typeof event.id!=='string' || !/^MOCK-EVT-[a-f0-9-]{36}$/.test(event.id)
    || !STATES.includes(event.status) || typeof event.createdAt!=='string'
    || !Number.isFinite(Date.parse(event.createdAt)) || Math.abs(now-Date.parse(event.createdAt))>300000) {
    throw new MockError('Evento de simulação inválido ou expirado.');
  }
  const receipt=simulation.simulationStatus(event.orderToken,env,now);
  if(event.transactionId!==receipt.orderId || event.amount!==receipt.amount)throw new MockError('Evento não corresponde à simulação.',409);
  return {received:true,simulated:true,eventId:event.id,transactionId:receipt.orderId,status:`simulated_${event.status}`,
    message:'Evento fictício recebido. Nenhum pagamento, aposta ou pedido financeiro foi alterado.'};
}
function createMockHandlers({env=process.env,clock=Date.now,transport=globalThis.fetch}={}) {
  function wrap(action){return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options','nosniff');
    const reply=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
    try{
      const config=settings(env);
      if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'Use POST'});}
      return await action(req,reply,config);
    }catch(error){
      const known=error instanceof MockError || error instanceof simulation.SimulationError;
      return reply(known?error.status:500,{error:known?error.message:'Falha no webhook de estudo.'});
    }
  };}
  const receiver=wrap(async(req,reply,{secret})=>{
    const event=await jsonBody(req);
    const received=req.headers['x-mock-signature'];
    if(!sameSecret(received,signature(event,secret)))throw new MockError('Assinatura de teste inválida.',401);
    return reply(200,validateEvent(event,env,clock()));
  });
  const sender=wrap(async(req,reply,{trigger,secret,preview})=>{
    if(!sameSecret(req.headers.authorization,`Bearer ${trigger}`))throw new MockError('Autenticação de teste necessária.',401);
    const input=await jsonBody(req);
    const status=input.status || 'paid';
    if(!STATES.includes(status))throw new MockError('Status de teste inválido.');
    const now=clock();
    const receipt=simulation.simulationStatus(input.orderToken,env,now);
    const event={id:`MOCK-EVT-${randomUUID()}`,type:'mock.transaction.updated',transactionId:receipt.orderId,
      orderToken:input.orderToken,amount:receipt.amount,status,simulated:true,createdAt:new Date(now).toISOString()};
    const target=targetUrl(env,preview);
    let response,result;
    try{
      response=await transport(target,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
        headers:{'content-type':'application/json','x-mock-signature':signature(event,secret)},body:JSON.stringify(event)});
      if(!response.ok)throw new Error('Rejected');
      result=await response.json();
    }catch{throw new MockError('O webhook de teste não confirmou o recebimento.',502);}
    if(result?.simulated!==true || result.received!==true || result.eventId!==event.id
      || result.transactionId!==event.transactionId || result.status!==`simulated_${status}`) {
      throw new MockError('Resposta do webhook de teste inválida.',502);
    }
    return reply(200,{...result,webhookStatus:response.status});
  });
  return {sender,receiver};
}
module.exports={MockError,settings,signature,targetUrl,createMockHandlers};
