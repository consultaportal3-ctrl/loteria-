'use strict';
const {randomBytes, createHash} = require('node:crypto');
const QRCode = require('qrcode');
const {ApiError, env} = require('./api-bootstrap.js');
const store = require('./redis-store.js');
const {priceItems} = require('./blackcat-simulation.cjs');
const CONFIG_KEY = 'directpix:settings';
const names = {mega:'Mega-Sena',facil:'Lotofácil',quina:'Quina',milionaria:'+Milionária',mania:'Lotomania',timemania:'Timemania',dupla:'Dupla Sena',dia:'Dia de Sorte',loteca:'Loteca',super:'Super Sete'};
const digest = value => createHash('sha256').update(value).digest('hex');
const validRequest = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const ascii = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 $%*+\-./:]/g, '').replace(/\s+/g, ' ').trim();
function validDocument(value, type) {
  if (/^(\d)\1+$/.test(value)) return false;
  const length = type === 'cpf' ? 9 : 12;
  if (!new RegExp(`^\\d{${length + 2}}$`).test(value)) return false;
  for (let size = length; size < length + 2; size++) {
    const weights = type === 'cpf' ? Array.from({length:size}, (_, index) => size + 1 - index)
      : Array.from({length:size}, (_, index) => (size - index - 1) % 8 + 2);
    const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0);
    const expected = type === 'cpf' ? (sum * 10 % 11) % 10 : (sum % 11 < 2 ? 0 : 11 - sum % 11);
    if (expected !== Number(value[size])) return false;
  }
  return true;
}
function validateSettings(input) {
  if (!input || typeof input !== 'object' || typeof input.key !== 'string' || typeof input.receiverName !== 'string' || typeof input.city !== 'string') throw new ApiError(422, 'Preencha a chave, o nome do titular e a cidade.');
  if (!['cpf','cnpj','email','phone','random'].includes(input.keyType)) throw new ApiError(422, 'Selecione o tipo da chave PIX.');
  let key = input.key.trim();
  if (input.keyType === 'cpf' || input.keyType === 'cnpj') {
    key = key.replace(/[.\-/\s]/g, '');
    if (!validDocument(key, input.keyType)) throw new ApiError(422, 'A chave de CPF/CNPJ está em formato inválido.');
  } else if (input.keyType === 'email') {
    key = key.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) || !/^[\x21-\x7E]+$/.test(key) || Buffer.byteLength(key) > 77) throw new ApiError(422, 'Informe um e-mail PIX válido, com até 77 caracteres.');
  } else if (input.keyType === 'phone') {
    key = key.replace(/[\s()\-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(key)) throw new ApiError(422, 'Use o telefone com código do país, por exemplo +55 seguido do DDD e número.');
  } else {
    key = key.toLowerCase();
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key)) throw new ApiError(422, 'A chave aleatória precisa estar no formato UUID informado pelo banco.');
  }
  const receiverName = ascii(input.receiverName), city = ascii(input.city);
  if (!receiverName || receiverName.length > 25 || !city || city.length > 15) throw new ApiError(422, 'Use nome do titular com até 25 caracteres e cidade com até 15, sem abreviações que impeçam a identificação.');
  if (typeof input.enabled !== 'boolean' || input.ownershipConfirmed !== true) throw new ApiError(422, 'Confirme que a chave pertence ao recebedor informado e está cadastrada no banco.');
  return {enabled:input.enabled, keyType:input.keyType, key, receiverName, city, updatedAt:new Date().toISOString()};
}
function tlv(id, value) {
  const size = Buffer.byteLength(value, 'utf8');
  if (size > 99) throw new ApiError(422, 'Um campo PIX excedeu o tamanho permitido.');
  return id + String(size).padStart(2, '0') + value;
}
function crc16(value) {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function brCode({key, receiverName, city}, amount, txid) {
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 20000000 || !/^[A-Za-z0-9]{1,25}$/.test(txid)) throw new ApiError(422, 'Valor ou referência PIX inválida.');
  const payload = tlv('00', '01') + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key))
    + tlv('52', '0000') + tlv('53', '986') + tlv('54', (amount / 100).toFixed(2))
    + tlv('58', 'BR') + tlv('59', receiverName) + tlv('60', city) + tlv('62', tlv('05', txid)) + '6304';
  return payload + crc16(payload);
}
async function settings() { return store.configured() ? store.get(CONFIG_KEY) : null; }
async function saveSettings(input) {
  const config = validateSettings(input);
  await store.command('SET', CONFIG_KEY, JSON.stringify(config));
  return config;
}
function info(config) {
  return {simulation:false, environment:'live', provider:'direct-pix', manualConfirmation:true,
    publicName:env('BUSINESS_PUBLIC_NAME', 'L7 PG'), legalName:config.receiverName, address:config.city,
    contactEmail:env('BUSINESS_CONTACT_EMAIL'), privacyUrl:env('BUSINESS_PRIVACY_URL'), termsUrl:env('BUSINESS_TERMS_URL'),
    notice:'PIX direto para a chave cadastrada pelo operador. Confira o titular no banco. A confirmação do recebimento é manual.', fulfillmentStatus:'awaiting_registration'};
}
function publicOrder(order, token) {
  return {...order.business, orderId:order.id, orderToken:token, operator:order.receiverName,
    amount:order.amount, status:order.status, qrCode:order.qrCode, qrCodeImage:order.qrCodeImage,
    expiresAt:null, updatedAt:order.updatedAt, fulfillmentStatus:'awaiting_registration'};
}
async function createPayment(input, config) {
  if (!config?.enabled) throw new ApiError(503, 'O PIX direto não está ativado no painel.');
  if (!validRequest(input.requestId) || input.consent !== true) throw new ApiError(422, 'Confirme os termos e envie um identificador válido.');
  const buyer = input.buyer;
  if (!buyer || typeof buyer.name !== 'string' || buyer.name.trim().length < 3 || buyer.name.length > 100
    || typeof buyer.email !== 'string' || buyer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) throw new ApiError(422, 'Informe nome e e-mail válidos.');
  let priced;
  try { priced = priceItems(input.items); } catch (error) { throw new ApiError(422, error.message); }
  const items = input.items.map(item => ({...Object.fromEntries(['game','numbers','trevos','columns','picks','team','month','repeats','special'].filter(key => Object.hasOwn(item, key)).map(key => [key, item[key]])),
    name:item.game === 'mega' && item.special === 'virada' ? 'Mega da Virada' : names[item.game]}));
  const fingerprint = digest(JSON.stringify({name:buyer.name.trim(), email:buyer.email.trim(), items, amount:priced.amount}));
  const token = 'DP.' + input.requestId, key = 'directpix:order:' + digest(token);
  let order = await store.get(key);
  if (!order) {
    const id = randomBytes(12).toString('hex').toUpperCase();
    const qrCode = brCode(config, priced.amount, id);
    const qrCodeImage = await QRCode.toDataURL(qrCode, {errorCorrectionLevel:'M', margin:4, width:400});
    order = {id, fingerprint, items, amount:priced.amount, customer_name:buyer.name.trim(), customer_email:buyer.email.trim(),
      receiverName:config.receiverName, business:info(config), qrCode, qrCodeImage, status:'awaiting_manual_confirmation',
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
    if (await store.command('SET', key, JSON.stringify(order), 'NX') !== 'OK') order = await store.get(key);
    // Repeated requests repair the index if a previous response failed after saving the order.
  }
  if (!order || order.fingerprint !== fingerprint) throw new ApiError(409, 'Este identificador já pertence a outro pedido. Consulte o operador antes de gerar outro PIX.');
  await store.command('ZADD', 'directpix:orders', Date.parse(order.createdAt), key);
  await store.command('SET', 'directpix:reference:' + order.id, key);
  return publicOrder(order, token);
}
async function paymentStatus(token) {
  if (typeof token !== 'string' || !token.startsWith('DP.') || !validRequest(token.slice(3))) throw new ApiError(404, 'Pedido não encontrado.');
  const order = await store.get('directpix:order:' + digest(token));
  if (!order) throw new ApiError(404, 'Pedido não encontrado.');
  return publicOrder(order, token);
}
async function listOrders() {
  const keys = await store.command('ZREVRANGE', 'directpix:orders', 0, 199);
  if (!keys.length) return [];
  const values = await store.command('MGET', ...keys);
  return values.filter(Boolean).map(raw => {
    const {id, amount, items, customer_name, customer_email, status, createdAt, updatedAt, bankReference} = JSON.parse(raw);
    return {id, amount, items, customer_name, customer_email, status, createdAt, updatedAt, bankReference};
  });
}
async function confirmPayment(input) {
  if (input.bankChecked !== true || typeof input.orderId !== 'string' || !/^[A-F0-9]{24}$/.test(input.orderId)
    || typeof input.bankReference !== 'string' || input.bankReference.trim().length < 4 || input.bankReference.length > 100) throw new ApiError(422, 'Confira o crédito no extrato e informe a referência da transação bancária.');
  const found = await store.command('GET', 'directpix:reference:' + input.orderId);
  if (!found) throw new ApiError(404, 'Pedido não encontrado.');
  const saved = await store.command('EVAL', `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return false end
    local order = cjson.decode(raw)
    if order.status == 'awaiting_manual_confirmation' then
      order.status = 'manual_confirmed'
      order.bankReference = ARGV[1]
      order.updatedAt = ARGV[2]
      order.confirmedBy = 'admin'
      redis.call('SET', KEYS[1], cjson.encode(order))
    end
    return order.status
  `, 1, found, input.bankReference.trim(), new Date().toISOString());
  if (!saved) throw new ApiError(404, 'Pedido não encontrado.');
  if (saved !== 'manual_confirmed') throw new ApiError(409, 'O estado deste pedido não permite confirmação manual.');
  return {confirmed:true, status:saved};
}
module.exports = {validateSettings, brCode, crc16, settings, saveSettings, info, createPayment, paymentStatus, listOrders, confirmPayment};
