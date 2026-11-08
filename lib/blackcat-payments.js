'use strict';
const {randomUUID, createHash, timingSafeEqual} = require('node:crypto');
const {ApiError, env, normalizeTaxId, businessConfig} = require('./api-bootstrap.js');
const {priceItems} = require('./blackcat-simulation.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const validToken = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const names = {mega:'Mega-Sena',facil:'Lotofácil',quina:'Quina',milionaria:'+Milionária',mania:'Lotomania',timemania:'Timemania',dupla:'Dupla Sena',dia:'Dia de Sorte',loteca:'Loteca',super:'Super Sete'};
const statuses = {PENDING:'pending',PAID:'approved',CANCELLED:'cancelled',REFUNDED:'refunded'};
function config() {
  if (env('BLACKCAT_MODE') !== 'live') throw new ApiError(503, 'Pagamentos reais não estão habilitados no servidor.');
  const key = env('BLACKCAT_API_KEY'), secret = env('BLACKCAT_WEBHOOK_SECRET');
  const redisUrl = env('UPSTASH_REDIS_REST_URL') || env('KV_REST_API_URL');
  const redisToken = env('UPSTASH_REDIS_REST_TOKEN') || env('KV_REST_API_TOKEN');
  let base, redis;
  try { base = new URL(env('APP_BASE_URL')); } catch {}
  try { redis = new URL(redisUrl); } catch {}
  const problems = [];
  if (!key) problems.push('BLACKCAT_API_KEY não foi configurada');
  if (secret.length < 32) problems.push('BLACKCAT_WEBHOOK_SECRET precisa ter pelo menos 32 caracteres');
  if (base?.protocol !== 'https:') problems.push('APP_BASE_URL precisa conter o endereço HTTPS da loja');
  if (redis?.protocol !== 'https:') problems.push('KV_REST_API_URL (ou UPSTASH_REDIS_REST_URL) precisa conter o endereço HTTPS do Redis');
  if (!redisToken) problems.push('KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_TOKEN) não foi configurado com o token de leitura e escrita');
  if (problems.length) throw new ApiError(503, 'Configuração pendente: ' + problems.join('; ') + '.');
  return {key, secret, base:base.origin, redis:redis.origin, redisToken};
}
async function command(...args) {
  const settings = config();
  try {
    const response = await fetch(settings.redis, {method:'POST', redirect:'error', signal:AbortSignal.timeout(5000),
      headers:{Authorization:`Bearer ${settings.redisToken}`, 'Content-Type':'application/json'}, body:JSON.stringify(args)});
    const data = await response.json();
    if (!response.ok || data.error || !Object.hasOwn(data, 'result')) throw new Error();
    return data.result;
  } catch { throw new ApiError(503, 'O armazenamento de pedidos está indisponível.'); }
}
async function gateway(route, payload) {
  const settings = config();
  try {
    const response = await fetch('https://api.blackcatoficial.com/api' + route, {
      method:payload ? 'POST' : 'GET', redirect:'error', signal:AbortSignal.timeout(6500),
      headers:{'X-API-Key':settings.key, 'Content-Type':'application/json'}, body:payload ? JSON.stringify(payload) : undefined,
    });
    const result = await response.json();
    if (!response.ok || result.success !== true || !result.data) throw new Error();
    return result.data;
  } catch { throw new ApiError(502, 'Não foi possível confirmar a resposta da BlackCat. Consulte o pedido antes de tentar outra cobrança.'); }
}
function validateBuyer(buyer) {
  if (!buyer || typeof buyer.name !== 'string' || buyer.name.trim().length < 3 || buyer.name.length > 100
    || typeof buyer.email !== 'string' || buyer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) throw new ApiError(422, 'Informe nome e e-mail válidos.');
  const phone = typeof buyer.phone === 'string' ? buyer.phone.replace(/\D/g, '') : '';
  const cpf = typeof buyer.cpf === 'string' ? buyer.cpf.replace(/\D/g, '') : '';
  if (!/^\d{10,13}$/.test(phone)) throw new ApiError(422, 'Informe um telefone válido com DDD.');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) throw new ApiError(422, 'Informe um CPF válido.');
  for (const length of [9, 10]) {
    const sum = [...cpf.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    if ((sum * 10 % 11) % 10 !== Number(cpf[length])) throw new ApiError(422, 'Informe um CPF válido.');
  }
  return {name:buyer.name.trim(), email:buyer.email.trim(), phone, document:{type:'cpf', number:cpf}};
}
const orderKey = token => 'payments:order:' + hash(token);
async function load(key) { const raw = await command('GET', key); return raw ? JSON.parse(raw) : null; }
async function save(key, order) {
  const result = await command('EVAL', `
    local raw = redis.call('GET', KEYS[1])
    local current = raw and cjson.decode(raw) or {}
    local incoming = cjson.decode(ARGV[1])
    local prior = current.status
    for k,v in pairs(incoming) do current[k] = v end
    if prior == 'refunded' or (prior == 'approved' and incoming.status ~= 'refunded') then current.status = prior end
    local encoded = cjson.encode(current)
    redis.call('SET', KEYS[1], encoded)
    return encoded
  `, 1, key, JSON.stringify(order));
  return JSON.parse(result);
}
async function verifySeller(business) {
  const seller = await gateway('/sales/seller');
  if (seller.cnpj === undefined || seller.cnpj === null || seller.cnpj === '') throw new ApiError(503, 'A BlackCat respondeu à consulta do vendedor, mas não informou data.cnpj. Não foi possível verificar o recebedor. Solicite ao suporte BlackCat a conferência do cadastro e do retorno de /sales/seller.');
  const actual = normalizeTaxId(seller.cnpj);
  const expected = normalizeTaxId(business.taxId);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(actual)) throw new ApiError(503, 'A BlackCat retornou data.cnpj em formato inválido. Solicite ao suporte BlackCat a conferência do retorno de /sales/seller.');
  if (!/^[A-Z0-9]{12}\d{2}$/.test(expected)) throw new ApiError(503, 'BUSINESS_CNPJ está em formato inválido. Confira o cadastro do operador.');
  const masked = value => value.slice(0, 4) + '******' + value.slice(-4);
  if (actual !== expected) throw new ApiError(503, `O CNPJ do operador não corresponde ao recebedor BlackCat. Comparação parcial: BUSINESS_CNPJ ${masked(expected)}; conta da chave BlackCat ${masked(actual)}. Confira os 14 caracteres completos e a conta vinculada à chave.`);
}
function publicOrder(order, token, business) {
  if (!order.transactionId) throw new ApiError(409, `Pedido ${order.id} em conferência. Não gere outra cobrança; contate o operador para verificar a transação.`);
  if (!order.qrCode && order.status === 'pending') throw new ApiError(409, `Pedido ${order.id} criado, mas sem código PIX disponível. Contate o operador antes de iniciar outra cobrança.`);
  return {...business, simulation:false, environment:'live', orderId:order.id, orderToken:token,
    operator:business?.legalName, amount:order.amount, status:order.status,
    fulfillmentStatus:'awaiting_registration', qrCode:order.qrCode, qrCodeImage:order.qrCodeImage, expiresAt:order.expiresAt};
}
async function createPayment(input) {
  const settings = config();
  const business = businessConfig();
  const customer = validateBuyer(input.buyer);
  if (input.consent !== true) throw new ApiError(422, 'Aceite os termos e a política de privacidade.');
  if (!validToken(input.requestId)) throw new ApiError(422, 'Identificador de pedido inválido.');
  let priced;
  try { priced = priceItems(input.items); } catch (error) { throw new ApiError(422, error.message); }
  const items = input.items.map(item => Object.fromEntries(['game','numbers','trevos','columns','picks','team','month','repeats','special'].filter(key => Object.hasOwn(item, key)).map(key => [key, item[key]])));
  const fingerprint = hash(JSON.stringify({items, customer}));
  const key = orderKey(input.requestId);
  let order = await load(key);
  if (order) {
    if (order.fingerprint !== fingerprint) throw new ApiError(409, 'O pedido já existe com outros dados. Confira o pagamento anterior antes de iniciar outro pedido.');
    return publicOrder(order, input.requestId, business);
  }
  await verifySeller(business);
  order = {id:randomUUID(), fingerprint, items, amount:priced.amount, customer_name:customer.name, customer_email:customer.email, status:'creating', created_at:new Date().toISOString()};
  if (await command('SET', key, JSON.stringify(order), 'NX') !== 'OK') throw new ApiError(409, 'Pedido em processamento. Consulte novamente em alguns segundos.');
  // Persist the reference before contacting the provider. Never automatically repeat an ambiguous POST.
  await command('SET', 'payments:reference:' + order.id, key);
  await command('ZADD', 'payments:orders', Date.now(), key);
  const callback = new URL('/api/webhook', settings.base);
  callback.searchParams.set('secret', settings.secret);
  const result = await gateway('/sales/create-sale', {
    amount:priced.amount, currency:'BRL', paymentMethod:'pix', customer,
    items:priced.items.map((item, index) => ({...item, title:names[items[index].game]})),
    externalRef:order.id, postbackUrl:callback.toString(), pix:{expiresInDays:1},
  });
  if (typeof result.transactionId !== 'string' || result.amount !== order.amount || !Object.hasOwn(statuses, result.status)
    || String(result.paymentMethod).toLowerCase() !== 'pix') throw new ApiError(502, 'A BlackCat retornou uma transação inconsistente. Consulte o operador antes de tentar novamente.');
  const payment = result.paymentData || {};
  const code = payment.copyPaste || payment.qrCode;
  const image = payment.qrCodeBase64;
  // Persist the transaction even if the provider omits its QR image, allowing reconciliation.
  order = {...order, transactionId:result.transactionId, status:statuses[result.status], qrCode:typeof code === 'string' ? code : '',
    qrCodeImage:typeof image === 'string' && /^(?:data:image\/png;base64,)?[A-Za-z0-9+/=]+$/.test(image) ? (image.startsWith('data:') ? image : 'data:image/png;base64,' + image) : '',
    expiresAt:payment.expiresAt || null, updated_at:new Date().toISOString()};
  order = await save(key, order);
  await command('SET', 'payments:transaction:' + hash(order.transactionId), key);
  return publicOrder(order, input.requestId, business);
}
async function refresh(key, order, expectedTransaction) {
  const id = order.transactionId || expectedTransaction;
  if (!id) return order;
  const data = await gateway('/sales/' + encodeURIComponent(id) + '/status');
  if (data.transactionId !== id || data.amount !== order.amount || String(data.paymentMethod).toLowerCase() !== 'pix' || !Object.hasOwn(statuses, data.status)) throw new ApiError(502, 'A transação retornada pelo gateway não corresponde ao pedido.');
  // Only update payment state. A confirmed payment never registers a lottery ticket.
  order = {...order, transactionId:id, status:statuses[data.status], updated_at:new Date().toISOString()};
  return save(key, order);
}
async function paymentStatus(token) {
  config();
  if (!validToken(token)) throw new ApiError(404, 'Pedido não encontrado.');
  const key = orderKey(token);
  let order = await load(key);
  if (!order) throw new ApiError(404, 'Pedido não encontrado.');
  order = await refresh(key, order);
  return publicOrder(order, token, businessConfig());
}
async function webhook(secret, input) {
  const settings = config();
  if (typeof secret !== 'string' || Buffer.byteLength(secret) !== Buffer.byteLength(settings.secret)
    || !timingSafeEqual(Buffer.from(secret), Buffer.from(settings.secret))) throw new ApiError(403, 'Webhook não autorizado.');
  if (typeof input.transactionId !== 'string' || input.transactionId.length > 200) throw new ApiError(400, 'Transação inválida.');
  let key = await command('GET', 'payments:transaction:' + hash(input.transactionId));
  if (!key && typeof input.externalReference === 'string' && /^[a-f0-9-]{36}$/.test(input.externalReference)) key = await command('GET', 'payments:reference:' + input.externalReference);
  if (!key) return {received:true};
  const order = await load(key);
  if (order) await refresh(key, order, input.transactionId);
  return {received:true};
}
module.exports = {config, command, gateway, validateBuyer, verifySeller, createPayment, paymentStatus, webhook};
