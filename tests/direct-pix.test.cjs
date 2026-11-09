'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {PNG} = require('pngjs');
const jsQR = require('jsqr');
const pix = require('../lib/direct-pix.js');
const admin = require('../api/pix-settings.js');
const checkout = require('../api/checkout-info.js');
const create = require('../api/create-payment.js');
const status = require('../api/payment-status.js');
const config = {keyType:'random', key:'123e4567-e12b-12d1-a456-426655440000', receiverName:'Titular Teste', city:'Brasília', enabled:true, ownershipConfirmed:true};

test('BR Code follows the official CRC reference and preserves amount and transaction reference', () => {
  const official = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.equal(pix.crc16(official), '1D3D');
  assert.equal(pix.crc16('123456789'), '29B1');
  const saved = pix.validateSettings(config);
  const code = pix.brCode(saved, 12345, 'L7TESTE123');
  assert.ok(code.includes('5406123.45'));
  assert.ok(code.includes('5913TITULAR TESTE'));
  assert.ok(code.includes('6008BRASILIA'));
  assert.ok(code.includes('0510L7TESTE123'));
  assert.equal(code.slice(-4), pix.crc16(code.slice(0, -4)));
  assert.throws(() => pix.brCode(saved, 0, 'test'));
  assert.throws(() => pix.brCode(saved, 100, 'not-a-valid-reference'));
  assert.equal(pix.validateSettings({...config, keyType:'cpf', key:'529.982.247-25'}).key, '52998224725');
  assert.equal(pix.validateSettings({...config, keyType:'cnpj', key:'12.345.678/0001-95'}).key, '12345678000195');
  assert.throws(() => pix.validateSettings({...config, keyType:'cpf', key:'11111111111'}));
  assert.throws(() => pix.validateSettings({...config, keyType:'phone', key:'11999999999'}));
  assert.equal(pix.validateSettings({...config, keyType:'phone', key:'+55 (11) 99999-9999'}).key, '+5511999999999');
  assert.throws(() => pix.validateSettings({...config, ownershipConfirmed:false}));
});

test('protected panel configures direct PIX, QR decodes correctly, and only admin can confirm receiving', async () => {
  const originalEnv = {...process.env}, originalFetch = global.fetch;
  const records = new Map(), expiry = new Map(), indexes = new Map();
  let clock = Date.now();
  const read = key => { if (expiry.has(key) && expiry.get(key) <= clock) { records.delete(key); expiry.delete(key); } return records.get(key) ?? null; };
  Object.assign(process.env, {KV_REST_API_URL:'https://direct-pix-test.upstash.io', KV_REST_API_TOKEN:'test-only-redis-token', ADMIN_PASSWORD:'test-only-admin-password-12345', BUSINESS_CNPJ:'', BUSINESS_PUBLIC_NAME:'Loja Teste', BLACKCAT_MODE:'live'});
  delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; delete process.env.ADMIN_PASSWORD_HASH; delete process.env.BLACKCAT_API_KEY;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://direct-pix-test.upstash.io', 'direct PIX never calls a payment gateway or external QR service');
    const [op, ...args] = JSON.parse(options.body);
    let result;
    if (op === 'GET') result = read(args[0]);
    else if (op === 'SET') {
      result = args.includes('NX') && read(args[0]) !== null ? null : 'OK';
      if (result) { records.set(args[0], args[1]); const index = args.indexOf('EX'); if (index >= 0) expiry.set(args[0], clock + Number(args[index + 1]) * 1000); }
    } else if (op === 'DEL') { result = 0; for (const key of args) { if (records.delete(key)) result++; expiry.delete(key); } }
    else if (op === 'ZADD') { const index = indexes.get(args[0]) || new Map(); index.set(args[2], Number(args[1])); indexes.set(args[0], index); result = 1; }
    else if (op === 'ZREVRANGE') result = [...(indexes.get(args[0]) || new Map()).entries()].sort((a,b) => b[1]-a[1]).slice(Number(args[1]), Number(args[2]) === -1 ? undefined : Number(args[2]) + 1).map(([key]) => key);
    else if (op === 'MGET') result = args.map(read);
    else if (op === 'EVAL' && args[0].includes('INCR')) {
      const key = args[2]; result = Number(read(key) || 0) + 1; records.set(key, String(result)); if (result === 1) expiry.set(key, clock + 900000);
    } else if (op === 'EVAL') {
      const key = args[2], raw = read(key);
      if (!raw) result = null;
      else {
        const order = JSON.parse(raw);
        if (order.status === 'awaiting_manual_confirmation') { order.status = 'manual_confirmed'; order.bankReference = args[3]; order.updatedAt = args[4]; order.confirmedBy = 'admin'; records.set(key, JSON.stringify(order)); }
        result = order.status;
      }
    } else throw new Error('Unexpected command ' + op);
    return {ok:true, json:async () => ({result})};
  };
  async function request(handler, {action = '', method = 'GET', body, cookie = '', origin = 'https://shop.test', url} = {}) {
    const headers = {}; let data, code;
    await handler({url:url || '/api/pix-settings?action=' + action, method, body,
      headers:{host:'shop.test', origin, cookie, 'content-type':'application/json'}, socket:{encrypted:true, remoteAddress:'127.0.0.1'}},
    {setHeader(key, value) { headers[key] = value; }, set statusCode(value) { code = value; }, end(value) { data = JSON.parse(value); }});
    return {status:code, data, headers, cookie:headers['Set-Cookie']?.split(';')[0]};
  }
  try {
    assert.equal((await request(admin, {action:'settings'})).status, 401);
    const initial = await request(admin, {action:'session'});
    assert.equal(initial.data.authenticated, false);
    assert.match(initial.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);
    let cookie = initial.cookie, csrf = initial.data.csrf;
    const post = (action, data = {}) => ({method:'POST', cookie, body:{action, csrf, ...data}});
    assert.equal((await request(admin, post('save', {settings:config}))).status, 401);
    assert.equal((await request(admin, {...post('login', {password:process.env.ADMIN_PASSWORD}), origin:'https://evil.test'})).status, 403);
    assert.equal((await request(admin, post('login', {password:process.env.ADMIN_PASSWORD, csrf:'bad'}))).status, 403);
    const signed = await request(admin, post('login', {password:process.env.ADMIN_PASSWORD}));
    assert.equal(signed.status, 200); cookie = signed.cookie; csrf = signed.data.csrf;
    assert.notEqual(cookie, initial.cookie);
    assert.equal((await request(admin, {action:'settings', cookie:initial.cookie})).status, 401);
    assert.equal((await request(admin, post('save', {settings:config}))).status, 200);
    const info = await request(checkout);
    assert.equal(info.status, 200); assert.equal(info.data.provider, 'direct-pix'); assert.equal(info.data.taxId, undefined);
    const input = {requestId:randomUUID(), consent:true, buyer:{name:'Cliente Teste', email:'cliente@example.invalid'}, items:[{game:'mega', numbers:[1,2,3,4,5,6], referencePrice:0.01}]};
    const created = await request(create, {method:'POST', body:input});
    assert.equal(created.status, 201); assert.equal(created.data.amount, 600);
    assert.equal(created.data.status, 'awaiting_manual_confirmation'); assert.equal(created.data.expiresAt, null);
    const png = PNG.sync.read(Buffer.from(created.data.qrCodeImage.split(',')[1], 'base64'));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(decoded.data, created.data.qrCode);
    assert.equal((await request(create, {method:'POST', body:input})).data.orderId, created.data.orderId);
    assert.equal((await request(create, {method:'POST', body:{...input, buyer:{...input.buyer, name:'Outro Cliente'}}})).status, 409);
    const tokenURL = '/api/payment-status?token=' + encodeURIComponent(created.data.orderToken);
    assert.equal((await request(status, {url:tokenURL})).data.status, 'awaiting_manual_confirmation');
    assert.equal((await request(status, {method:'POST', url:tokenURL, body:{status:'approved'}})).status, 405);
    assert.equal((await request(admin, {action:'orders', cookie})).data.orders.length, 1);
    assert.equal((await request(admin, post('confirm', {orderId:created.data.orderId, bankReference:'BANK-TEST-REF', bankChecked:false}))).status, 422);
    assert.equal((await request(admin, post('confirm', {orderId:created.data.orderId, bankReference:'BANK-TEST-REF', bankChecked:true}))).data.status, 'manual_confirmed');
    const confirmed = await request(status, {url:tokenURL});
    assert.equal(confirmed.data.status, 'manual_confirmed'); assert.equal(confirmed.data.fulfillmentStatus, 'awaiting_registration');
    await request(admin, post('confirm', {orderId:created.data.orderId, bankReference:'SHOULD-NOT-OVERWRITE', bankChecked:true}));
    assert.equal((await request(admin, {action:'orders', cookie})).data.orders[0].bankReference, 'BANK-TEST-REF');
    // Changing the key affects new orders only. The prior order remains reproducible.
    await request(admin, post('save', {settings:{...config, keyType:'email', key:'pix@example.invalid'}}));
    assert.equal((await request(create, {method:'POST', body:input})).data.qrCode, created.data.qrCode);
    const next = await request(create, {method:'POST', body:{...input, requestId:randomUUID()}});
    assert.ok(next.data.qrCode.includes('pix@example.invalid'));
    clock += 28801000;
    assert.equal((await request(admin, {action:'orders', cookie})).status, 401);
    const renewed = await request(admin, {action:'session'}); cookie = renewed.cookie; csrf = renewed.data.csrf;
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await request(admin, post('login', {password:'wrong'}))).status, 401);
    assert.equal((await request(admin, post('login', {password:process.env.ADMIN_PASSWORD}))).status, 429);
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  }
});
