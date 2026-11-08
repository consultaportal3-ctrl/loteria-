'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const payments = require('../lib/blackcat-payments.js');
const createHandler = require('../api/create-payment.js');

test('live payments persist, deduplicate, verify upstream amounts and never register tickets', async () => {
  const originalEnv = {...process.env};
  const originalFetch = global.fetch;
  const records = new Map();
  let creates = 0, reportedStatus = 'PENDING', reportedAmount = 600, failCreate = false;
  Object.assign(process.env, {BLACKCAT_MODE:'live', BLACKCAT_API_KEY:'test-only-secret', BLACKCAT_WEBHOOK_SECRET:'a'.repeat(64),
    APP_BASE_URL:'https://example.test', UPSTASH_REDIS_REST_URL:'https://test.upstash.io', UPSTASH_REDIS_REST_TOKEN:'test-only-token',
    BUSINESS_PUBLIC_NAME:'Teste', BUSINESS_LEGAL_NAME:'Teste Ltda', BUSINESS_CNPJ:'12345678000190', BUSINESS_ADDRESS:'Rua de teste',
    BUSINESS_CONTACT_EMAIL:'teste@example.invalid', BUSINESS_PRIVACY_URL:'https://example.test/privacy', BUSINESS_TERMS_URL:'https://example.test/terms'});
  const response = data => ({ok:true, json:async () => data});
  global.fetch = async (url, options) => {
    if (url === 'https://test.upstash.io') {
      assert.equal(options.headers.Authorization, 'Bearer test-only-token');
      const [op, ...args] = JSON.parse(options.body);
      if (op === 'GET') return response({result:records.get(args[0]) || null});
      if (op === 'SET') {
        if (args[2] === 'NX' && records.has(args[0])) return response({result:null});
        records.set(args[0], args[1]); return response({result:'OK'});
      }
      if (op === 'ZADD') return response({result:1});
      if (op === 'EVAL') {
        const key = args[2], incoming = JSON.parse(args[3]), existing = JSON.parse(records.get(key) || '{}');
        const merged = {...existing, ...incoming};
        if (existing.status === 'refunded' || (existing.status === 'approved' && incoming.status !== 'refunded')) merged.status = existing.status;
        records.set(key, JSON.stringify(merged));
        return response({result:JSON.stringify(merged)});
      }
      throw new Error('Unexpected Redis command: ' + op);
    }
    assert.equal(options.headers['X-API-Key'], 'test-only-secret');
    if (url === 'https://api.blackcatoficial.com/api/sales/seller') return response({success:true, data:{cnpj:'12.345.678/0001-90'}});
    if (url === 'https://api.blackcatoficial.com/api/sales/create-sale') {
      creates++;
      if (failCreate) throw new Error('Timeout with unknown provider outcome');
      const input = JSON.parse(options.body);
      assert.equal(input.amount, 600);
      assert.equal(input.items[0].title, 'Mega-Sena');
      assert.equal(input.customer.document.number, '52998224725');
      assert.equal(new URL(input.postbackUrl).searchParams.get('secret'), 'a'.repeat(64));
      return response({success:true, data:{transactionId:'TXN-TEST', amount:600, status:'PENDING', paymentMethod:'pix', paymentData:{copyPaste:'000201-test-fixture', qrCodeBase64:'data:image/png;base64,aGVsbG8=', expiresAt:'2027-01-01T00:00:00Z'}}});
    }
    if (url === 'https://api.blackcatoficial.com/api/sales/TXN-TEST/status') return response({success:true, data:{transactionId:'TXN-TEST', amount:reportedAmount, status:reportedStatus, paymentMethod:'PIX'}});
    throw new Error('Unexpected URL: ' + url);
  };
  try {
    const input = {requestId:randomUUID(), consent:true, buyer:{name:'Cliente Teste', email:'cliente@example.invalid', phone:'11999999999', cpf:'52998224725'}, items:[{game:'mega', numbers:[1,2,3,4,5,6], referencePrice:0.01}]};
    assert.throws(() => payments.validateBuyer({...input.buyer, cpf:'11111111111'}), error => error.status === 422);
    await assert.rejects(payments.createPayment({...input, consent:false}), error => error.status === 422);
    const created = await payments.createPayment(input);
    assert.equal(created.simulation, false);
    assert.equal(created.amount, 600);
    assert.equal(created.fulfillmentStatus, 'awaiting_registration');
    assert.equal((await payments.createPayment(input)).orderId, created.orderId);
    assert.equal(creates, 1);
    assert.equal(JSON.stringify([...records.values()]).includes(input.buyer.cpf), false);
    await assert.rejects(payments.createPayment({...input, buyer:{...input.buyer, name:'Outro Cliente'}}), error => error.status === 409);
    const forged = {transactionId:'TXN-TEST', externalReference:created.orderId, status:'PAID'};
    await assert.rejects(payments.webhook('bad', forged), error => error.status === 403);
    await payments.webhook('a'.repeat(64), forged);
    assert.equal((await payments.paymentStatus(input.requestId)).status, 'pending');
    reportedAmount = 1;
    reportedStatus = 'PAID';
    await assert.rejects(payments.paymentStatus(input.requestId), error => error.status === 502);
    reportedAmount = 600;
    await payments.webhook('a'.repeat(64), forged);
    const paid = await payments.paymentStatus(input.requestId);
    assert.equal(paid.status, 'approved');
    assert.equal(paid.fulfillmentStatus, 'awaiting_registration');
    reportedStatus = 'PENDING';
    assert.equal((await payments.paymentStatus(input.requestId)).status, 'approved');
    reportedStatus = 'REFUNDED';
    assert.equal((await payments.paymentStatus(input.requestId)).status, 'refunded');
    assert.equal((await payments.paymentStatus(randomUUID()).catch(error => error)).status, 404);
    failCreate = true;
    const uncertain = {...input, requestId:randomUUID()};
    await assert.rejects(payments.createPayment(uncertain), error => error.status === 502);
    await assert.rejects(payments.createPayment(uncertain), error => error.status === 409);
    assert.equal(creates, 2, 'an ambiguous provider call is never automatically repeated');
    let status, body;
    await createHandler({url:'/api/create-payment', method:'POST', headers:{host:'example.test', origin:'https://evil.test'}}, {
      setHeader() {}, set statusCode(value) {status = value;}, end(value) {body = JSON.parse(value);},
    });
    assert.equal(status, 403);
    assert.equal(body.error.includes('test-only-secret'), false);
    delete process.env.BLACKCAT_API_KEY;
    assert.throws(() => payments.config(), error => error.status === 503);
    process.env.BLACKCAT_API_KEY = 'test-only-secret';
    process.env.KV_REST_API_URL = 'https://vercel-test.upstash.io';
    process.env.KV_REST_API_TOKEN = 'test-only-vercel-token';
    assert.equal(payments.config().redis, 'https://test.upstash.io', 'explicit Upstash configuration takes precedence');
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    assert.equal(payments.config().redis, 'https://vercel-test.upstash.io');
    assert.equal(payments.config().redisToken, 'test-only-vercel-token');
    delete process.env.KV_REST_API_TOKEN;
    process.env.KV_REST_API_READ_ONLY_TOKEN = 'read-only-test-token';
    assert.throws(() => payments.config(), error => error.status === 503, 'a read-only token cannot replace the write token');
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  }
});
