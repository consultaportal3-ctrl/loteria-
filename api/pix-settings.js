'use strict';
const {randomBytes, createHash, createHmac, timingSafeEqual} = require('node:crypto');
const {setTimeout: delay} = require('node:timers/promises');
const {ApiError, endpoint, env, requireMethod, requireSameOrigin, readJson, json} = require('../lib/api-bootstrap.js');
const {verifyPassword} = require('../lib/admin-password.js');
const store = require('../lib/redis-store.js');
const pix = require('../lib/direct-pix.js');
const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const authConfigured = () => /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(env('ADMIN_PASSWORD_HASH')) || env('ADMIN_PASSWORD').length >= 16;
const cookie = token => `pix_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`;
async function startSession(res, authenticated) {
  const token = randomBytes(32).toString('hex');
  const session = {csrf:randomBytes(32).toString('hex'), authenticated};
  const key = 'directpix:session:' + digest(token);
  await store.command('SET', key, JSON.stringify(session), 'EX', authenticated ? 28800 : 1800);
  res.setHeader('Set-Cookie', cookie(token));
  return {session, key};
}
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'GET', 'POST');
  if (req.method === 'POST') requireSameOrigin(req);
  const action = new URL(req.url, 'https://pix.invalid').searchParams.get('action');
  const token = /(?:^|;\s*)pix_admin=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  let key = token ? 'directpix:session:' + digest(token) : '';
  let session = key ? await store.get(key) : null;
  if (req.method === 'GET' && action === 'session') {
    if (!session) ({session, key} = await startSession(res, false));
    return json(res, {csrf:session.csrf, authenticated:session.authenticated, authConfigured:authConfigured()});
  }
  if (req.method === 'GET') {
    if (!session?.authenticated) throw new ApiError(401, 'Entre no painel para acessar as configurações e os pedidos.');
    if (action === 'visitors') return json(res, await require('../lib/visitors.js').list(new URL(req.url, 'https://pix.invalid').searchParams.get('offset')));
    if (action === 'settings') return json(res, {settings:await pix.settings()});
    if (action === 'orders') return json(res, {orders:await pix.listOrders()});
    throw new ApiError(404, 'Ação não encontrada.');
  }
  const input = await readJson(req);
  if (!session || !equal(session.csrf, input.csrf)) throw new ApiError(403, 'Sessão expirada. Atualize a página e entre novamente.');
  if (input.action === 'login') {
    if (!authConfigured()) throw new ApiError(503, 'Configure ADMIN_PASSWORD como segredo na Vercel com pelo menos 16 caracteres, ou ADMIN_PASSWORD_HASH, e faça um redeploy.');
    const adminSecret = env('ADMIN_PASSWORD_HASH') || env('ADMIN_PASSWORD');
    const client = createHmac('sha256', adminSecret).update(req.socket?.remoteAddress || 'unknown').digest('hex');
    const attempts = await store.command('EVAL', `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then redis.call('EXPIRE', KEYS[1], 900) end
      return count
    `, 1, 'directpix:login:' + client);
    if (attempts > 5) throw new ApiError(429, 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.');
    const validInput = typeof input.password === 'string' && Buffer.byteLength(input.password) <= 1024;
    const valid = validInput && (env('ADMIN_PASSWORD_HASH') ? await verifyPassword(input.password, env('ADMIN_PASSWORD_HASH')) : equal(digest(input.password), digest(env('ADMIN_PASSWORD'))));
    if (!valid) { await delay(300); throw new ApiError(401, 'Senha administrativa inválida.'); }
    await store.command('DEL', key, 'directpix:login:' + client);
    ({session, key} = await startSession(res, true));
    return json(res, {authenticated:true, csrf:session.csrf});
  }
  if (input.action === 'logout') {
    await store.command('DEL', key);
    res.setHeader('Set-Cookie', cookie('') + '; Max-Age=0');
    return json(res, {authenticated:false});
  }
  if (!session.authenticated) throw new ApiError(401, 'Autenticação necessária.');
  if (input.action === 'clear-visitors') {
    if (input.confirm !== true) throw new ApiError(422, 'Confirme a limpeza do histórico de visitas.');
    return json(res, await require('../lib/visitors.js').clear());
  }
  if (input.action === 'save') return json(res, {settings:await pix.saveSettings(input.settings)});
  if (input.action === 'confirm') return json(res, await pix.confirmPayment(input));
  throw new ApiError(400, 'Ação inválida.');
});
