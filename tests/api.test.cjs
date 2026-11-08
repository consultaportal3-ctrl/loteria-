'use strict';
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const {closeDb} = require('../lib/api-bootstrap.js');
const {hashPassword, verifyPassword} = require('../lib/admin-password.js');
const admin = require('../api/admin.js');
const business = require('../api/business-info.js');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-api-test-'));
const originalEnv = {...process.env};
after(() => {
  closeDb();
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  // Remove only the named SQLite test files in the directory created by this test.
  for (const name of ['store.sqlite', 'store.sqlite-wal', 'store.sqlite-shm']) {
    const filename = path.join(directory, name);
    if (fs.existsSync(filename)) fs.unlinkSync(filename);
  }
  fs.rmdirSync(directory);
});
async function request(handler, {method = 'GET', action = '', body, cookie = '', origin = 'https://example.test', address = '127.0.0.1'} = {}) {
  const headers = {};
  let data;
  await handler({url:'/api/admin?action=' + action, method, body,
    socket:{encrypted:true, remoteAddress:address},
    headers:{host:'example.test', origin, cookie, 'content-type':'application/json'}},
  {setHeader(name, value) { headers[name] = value; }, end(value) { data = JSON.parse(value); },
    get statusCode() { return this.code; }, set statusCode(value) { this.code = value; headers.status = value; }});
  return {status:headers.status, data, headers, cookie:headers['Set-Cookie']?.split(';')[0]};
}

test('real payment routes stay disabled without live configuration', async () => {
  process.env.BLACKCAT_MODE = 'simulation';
  for (const name of ['create-payment', 'payment-status', 'webhook']) {
    const result = await request(require(`../api/${name}.js`), {method:name === 'payment-status' ? 'GET' : 'POST', body:{}});
    assert.equal(result.status, 503);
    assert.equal(result.headers['Cache-Control'], 'no-store');
  }
  const checkout = await request(require('../api/checkout-info.js'));
  assert.equal(checkout.data.simulation, true);
});

test('production checkout reports configuration errors instead of falling back to simulation', async () => {
  const previousDeployment = process.env.VERCEL_ENV;
  const previousMode = process.env.BLACKCAT_MODE;
  try {
    process.env.VERCEL_ENV = 'production';
    for (const mode of ['', 'simulation']) {
      process.env.BLACKCAT_MODE = mode;
      const checkout = await request(require('../api/checkout-info.js'));
      assert.equal(checkout.status, 503);
      assert.match(checkout.data.error, /BLACKCAT_MODE=live/);
      assert.equal(checkout.data.simulation, undefined);
    }
  } finally {
    if (previousDeployment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousDeployment;
    if (previousMode === undefined) delete process.env.BLACKCAT_MODE; else process.env.BLACKCAT_MODE = previousMode;
  }
});

test('business identity validates configuration and methods', async () => {
  process.env.BUSINESS_PUBLIC_NAME = '';
  assert.equal((await request(business)).status, 503);
  Object.assign(process.env, {BUSINESS_PUBLIC_NAME:'Teste', BUSINESS_LEGAL_NAME:'Teste Ltda', BUSINESS_CNPJ:'12345678000190', BUSINESS_ADDRESS:'Rua de teste', BUSINESS_CONTACT_EMAIL:'teste@example.invalid', BUSINESS_PRIVACY_URL:'https://example.test/privacy', BUSINESS_TERMS_URL:'https://example.test/terms'});
  assert.equal((await request(business)).data.legalName, 'Teste Ltda');
  process.env.BUSINESS_CNPJ = '12.345.678/0001-90';
  assert.equal((await request(business)).data.taxId, '12345678000190');
  assert.equal((await request(business, {method:'POST'})).status, 405);
  process.env.BUSINESS_PRIVACY_URL = 'http://example.test/privacy';
  assert.equal((await request(business)).status, 503);
});

test('admin preserves historical SQLite orders, rotates sessions and blocks invalid access', async () => {
  // Create the old PHP schema before the Node.js backend opens the file.
  const historical = new DatabaseSync(path.join(directory, 'store.sqlite'));
  historical.exec(`CREATE TABLE orders (id TEXT PRIMARY KEY, customer_name TEXT, customer_email TEXT,
    items_json TEXT, amount_cents INTEGER, status TEXT, mp_payment_id TEXT, created_at TEXT, updated_at TEXT);
    INSERT INTO orders VALUES ('old-order', 'Cliente Teste', 'teste@example.invalid', '[{"name":"Mega-Sena"}]', 600, 'pending', 'historical-id', '2026-01-01', '2026-01-01');`);
  historical.close();
  process.env.APP_DATA_DIR = directory;
  process.env.ADMIN_PASSWORD_HASH = await hashPassword('test-password-only');
  assert.equal(await verifyPassword('wrong', process.env.ADMIN_PASSWORD_HASH), false);
  assert.equal(await verifyPassword('anything', '$2y$old-php-hash'), false);
  assert.equal((await request(admin, {action:'orders'})).status, 401);
  const initial = await request(admin, {action:'csrf'});
  assert.equal(initial.status, 200);
  assert.match(initial.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);
  const post = body => ({method:'POST', cookie:initial.cookie, body:{csrf:initial.data.csrf, ...body}});
  assert.equal((await request(admin, {...post({action:'login', password:'test-password-only'}), origin:'https://evil.test'})).status, 403);
  assert.equal((await request(admin, post({action:'login', csrf:'bad', password:'test-password-only'}))).status, 403);
  assert.equal((await request(admin, {method:'POST', cookie:initial.cookie, body:'{invalid-json'})).status, 400);
  assert.equal((await request(admin, {method:'POST', cookie:initial.cookie, body:'x'.repeat(65537)})).status, 413);
  const login = await request(admin, post({action:'login', password:'test-password-only'}));
  assert.equal(login.status, 200);
  assert.notEqual(login.cookie, initial.cookie);
  assert.notEqual(login.data.csrf, initial.data.csrf);
  assert.equal((await request(admin, {action:'orders', cookie:initial.cookie})).status, 401);
  const orders = await request(admin, {action:'orders', cookie:login.cookie});
  assert.equal(orders.data.orders[0].id, 'old-order');
  assert.deepEqual(orders.data.orders[0].items, [{name:'Mega-Sena'}]);
  assert.equal(orders.data.orders[0].amount_cents, 600);
  closeDb();
  assert.equal((await request(admin, {action:'orders', cookie:login.cookie})).status, 200);
  const logout = await request(admin, {method:'POST', cookie:login.cookie, body:{action:'logout', csrf:login.data.csrf}});
  assert.match(logout.headers['Set-Cookie'], /Max-Age=0/);
  assert.equal((await request(admin, {action:'orders', cookie:login.cookie})).status, 401);
  const retry = await request(admin, {action:'csrf'});
  for (let i = 0; i < 5; i++) {
    assert.equal((await request(admin, {method:'POST', cookie:retry.cookie, body:{action:'login', password:'bad', csrf:retry.data.csrf}})).status, 401);
  }
  assert.equal((await request(admin, {method:'POST', cookie:retry.cookie, body:{action:'login', password:'test-password-only', csrf:retry.data.csrf}})).status, 429);
  closeDb();
  process.env.APP_DATA_DIR = path.resolve(__dirname, '..');
  assert.equal((await request(admin, {action:'csrf'})).status, 503);
});
