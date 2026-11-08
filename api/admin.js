'use strict';
const {randomBytes, createHash, createHmac, timingSafeEqual} = require('node:crypto');
const {setTimeout: delay} = require('node:timers/promises');
const {ApiError, env, json, endpoint, requireMethod, requireSameOrigin, readJson, db} = require('../lib/api-bootstrap.js');
const {verifyPassword} = require('../lib/admin-password.js');
const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookie = token => `store_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`;
function newSession(database, res, authenticated, now) {
  const token = randomBytes(32).toString('hex');
  const session = {token_hash:digest(token), csrf:randomBytes(32).toString('hex'), authenticated:authenticated ? 1 : 0};
  database.prepare('INSERT INTO admin_sessions (token_hash, csrf, authenticated, expires_at) VALUES (?, ?, ?, ?)').run(session.token_hash, session.csrf, session.authenticated, now + 28800);
  res.setHeader('Set-Cookie', cookie(token));
  return session;
}
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'GET', 'POST');
  const action = new URL(req.url, 'https://admin.invalid').searchParams.get('action');
  // Deny unauthenticated orders before opening storage.
  const token = /(?:^|;\s*)store_admin=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  if (req.method === 'GET' && action === 'orders' && !token) throw new ApiError(401, 'Autenticação necessária.');
  if (req.method === 'POST') requireSameOrigin(req);
  const database = db();
  const now = Math.floor(Date.now() / 1000);
  database.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(now);
  let session = token ? database.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').get(digest(token)) : undefined;
  if (req.method === 'GET' && action === 'csrf') {
    session ||= newSession(database, res, false, now);
    return json(res, {csrf:session.csrf});
  }
  if (req.method === 'GET' && action === 'orders') {
    if (!session?.authenticated) throw new ApiError(401, 'Autenticação necessária.');
    const orders = database.prepare('SELECT id, customer_name, customer_email, items_json, amount_cents, status, mp_payment_id, created_at, updated_at FROM orders ORDER BY created_at DESC LIMIT 500').all().map(({items_json, ...order}) => {
      let items;
      try { items = JSON.parse(items_json); } catch { items = []; }
      return {...order, items:Array.isArray(items) ? items : [], amount_cents:Number(order.amount_cents)};
    });
    return json(res, {orders});
  }
  requireMethod(req, res, 'POST');
  const input = await readJson(req);
  if (!session || !equal(session.csrf, input.csrf)) throw new ApiError(403, 'Sessão expirada. Atualize a página e tente novamente.');
  if (input.action === 'login') {
    const passwordHash = env('ADMIN_PASSWORD_HASH');
    // Use the direct peer address. Only trust forwarded addresses in a configured reverse proxy.
    const address = req.socket?.remoteAddress || 'unknown';
    const client = createHmac('sha256', passwordHash || 'unconfigured').update(address).digest('hex');
    database.prepare('DELETE FROM admin_login_attempts WHERE window_started <= ?').run(now - 900);
    const rate = database.prepare('SELECT * FROM admin_login_attempts WHERE client_key = ?').get(client);
    if (rate?.attempts >= 5) throw new ApiError(429, 'Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.');
    // Reserve the attempt before asynchronous password verification, including concurrent requests.
    database.prepare('INSERT INTO admin_login_attempts (client_key, attempts, window_started) VALUES (?, 1, ?) ON CONFLICT(client_key) DO UPDATE SET attempts = attempts + 1').run(client, now);
    if (!await verifyPassword(input.password, passwordHash)) {
      await delay(300);
      throw new ApiError(401, 'Credenciais inválidas ou painel não configurado.');
    }
    database.prepare('DELETE FROM admin_login_attempts WHERE client_key = ?').run(client);
    database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(session.token_hash);
    session = newSession(database, res, true, now);
    return json(res, {authenticated:true, csrf:session.csrf});
  }
  if (input.action === 'logout') {
    database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(session.token_hash);
    res.setHeader('Set-Cookie', cookie('') + '; Max-Age=0');
    return json(res, {authenticated:false});
  }
  throw new ApiError(400, 'Ação inválida.');
});
