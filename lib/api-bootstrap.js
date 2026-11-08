'use strict';
const fs = require('node:fs');
const path = require('node:path');

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const env = (name, fallback = '') => (process.env[name] ?? fallback).trim();
function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(JSON.stringify(data));
}
function endpoint(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (error) { json(res, {error: error instanceof ApiError ? error.message : 'O servidor está indisponível.'}, error instanceof ApiError ? error.status : 500); }
  };
}
function requireMethod(req, res, ...methods) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    throw new ApiError(405, 'Método não permitido.');
  }
}
function requireSameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    const protocol = req.socket?.encrypted || req.headers['x-forwarded-proto'] === 'https' ? 'https:' : 'http:';
    if (origin.protocol !== protocol || origin.host.toLowerCase() !== String(req.headers.host).toLowerCase()
      || origin.origin !== req.headers.origin || req.headers['sec-fetch-site'] === 'cross-site') throw new Error();
  } catch { throw new ApiError(403, 'Origem não autorizada.'); }
}
async function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new ApiError(415, 'Envie JSON.');
  if (Number(req.headers['content-length'] || 0) > 65536) throw new ApiError(413, 'Requisição muito grande.');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > 65536) throw new ApiError(413, 'Requisição muito grande.');
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 65536) throw new ApiError(413, 'Requisição muito grande.');
    try { body = JSON.parse(body); } catch { throw new ApiError(400, 'JSON inválido.'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'JSON inválido.');
  if (Buffer.byteLength(JSON.stringify(body)) > 65536) throw new ApiError(413, 'Requisição muito grande.');
  return body;
}
function businessConfig() {
  const fields = {publicName:'BUSINESS_PUBLIC_NAME', legalName:'BUSINESS_LEGAL_NAME', taxId:'BUSINESS_CNPJ', address:'BUSINESS_ADDRESS', contactEmail:'BUSINESS_CONTACT_EMAIL', privacyUrl:'BUSINESS_PRIVACY_URL', termsUrl:'BUSINESS_TERMS_URL'};
  const config = Object.fromEntries(Object.entries(fields).map(([key, name]) => [key, env(name)]));
  config.taxId = config.taxId.toUpperCase();
  if (Object.values(config).some(value => !value)) throw new ApiError(503, 'Configure a identidade jurídica, contato e políticas públicas do operador antes de habilitar o checkout.');
  const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
  if (!/^[A-Z0-9]{12}\d{2}$/.test(config.taxId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.contactEmail)
    || !https(config.privacyUrl) || !https(config.termsUrl)) throw new ApiError(503, 'CNPJ, contato e políticas do operador devem estar válidos e públicos via HTTPS.');
  return config;
}
let database;
let databaseDirectory;
function db() {
  const directory = env('APP_DATA_DIR');
  if (!directory || !path.isAbsolute(directory)) throw new ApiError(503, 'Configure APP_DATA_DIR com uma pasta persistente fora da pasta pública do site.');
  let realDirectory;
  try {
    realDirectory = fs.realpathSync(directory);
    const root = fs.realpathSync(path.join(__dirname, '..'));
    const relative = path.relative(root, realDirectory);
    if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error();
    fs.accessSync(realDirectory, fs.constants.W_OK);
    fs.chmodSync(realDirectory, 0o700);
    const filename = path.join(realDirectory, 'store.sqlite');
    if (fs.existsSync(filename) && fs.lstatSync(filename).isSymbolicLink()) throw new Error();
    if (database && databaseDirectory === realDirectory) return database;
    const {DatabaseSync} = require('node:sqlite');
    const connection = new DatabaseSync(filename);
    try {
      fs.chmodSync(filename, 0o600);
      connection.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
          customer_email TEXT NOT NULL, items_json TEXT NOT NULL, amount_cents INTEGER NOT NULL,
          status TEXT NOT NULL, mp_payment_id TEXT UNIQUE, qr_code TEXT, qr_base64 TEXT,
          expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS admin_login_attempts (
          client_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_started INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS admin_sessions (
          token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, authenticated INTEGER NOT NULL DEFAULT 0,
          expires_at INTEGER NOT NULL
        );
      `);
    } catch (error) { connection.close(); throw error; }
    if (database) database.close();
    database = connection;
    databaseDirectory = realDirectory;
    return database;
  } catch { throw new ApiError(503, 'O armazenamento seguro do servidor está indisponível. Confira APP_DATA_DIR e o suporte a SQLite do Node.js.'); }
}
function closeDb() { if (database) database.close(); database = undefined; databaseDirectory = undefined; }
module.exports = {ApiError, env, json, endpoint, requireMethod, requireSameOrigin, readJson, businessConfig, db, closeDb};
