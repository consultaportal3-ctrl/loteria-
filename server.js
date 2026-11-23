'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const handlers = Object.fromEntries([
  'admin', 'blackcat-simulation', 'boloes', 'business-info', 'checkout-info',
  'create-payment', 'payment-status', 'pix-settings', 'visitors', 'webhook'
].map(name => [`/api/${name}`, require(`./api/${name}.js`)]));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8'
};

http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }

  if (pathname.startsWith('/api/')) {
    const handler = handlers[pathname];
    if (!handler) { res.writeHead(404).end(); return; }
    try { await handler(req, res); }
    catch (error) {
      console.error('API request failed:', error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {Allow: 'GET, HEAD'}).end(); return;
  }
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/compra-bolao' || pathname === '/compra-bolao/') pathname = '/compra-bolao/index.html';
  const publicPath = /^\/[a-zA-Z0-9_-]+\.html$/.test(pathname)
    || pathname === '/compra-bolao/index.html'
    || /^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname);
  if (!publicPath) { res.writeHead(404).end(); return; }
  const file = path.join(__dirname, pathname.slice(1));
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff'});
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}).listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log(`Servidor iniciado na porta ${process.env.PORT || 3000}`);
});
