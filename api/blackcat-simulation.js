'use strict';
const simulation = require('../lib/blackcat-simulation.cjs');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  const reply = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  try {
    simulation.requireSimulation();
    const url = new URL(req.url,'https://simulation.invalid');
    const action = url.searchParams.get('action');
    const method = action === 'create-payment' ? 'POST' : 'GET';
    if (req.method !== method) { res.setHeader('Allow',method); return reply(405,{error:'Método não permitido.'}); }
    if (action === 'checkout-info' || action === 'business-info') return reply(200,simulation.info());
    if (action === 'payment-status') return reply(200,simulation.simulationStatus(url.searchParams.get('token')));
    if (action !== 'create-payment') return reply(404,{error:'Endpoint de simulação não encontrado.'});
    const origin = req.headers.origin;
    let originHost;
    try { originHost = new URL(origin).host; } catch { return reply(403,{error:'Origem não autorizada.'}); }
    if (originHost !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') return reply(403,{error:'Origem não autorizada.'});
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(415,{error:'Envie JSON.'});
    if (Number(req.headers['content-length'] || 0) > 65536) return reply(413,{error:'Requisição muito grande.'});
    let body = req.body;
    if (body === undefined) {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 65536) return reply(413,{error:'Requisição muito grande.'});
        chunks.push(Buffer.from(chunk));
      }
      body = Buffer.concat(chunks).toString('utf8');
    }
    if (typeof body === 'string') {
      if (Buffer.byteLength(body) > 65536) return reply(413,{error:'Requisição muito grande.'});
      try { body = JSON.parse(body); } catch { return reply(400,{error:'JSON inválido.'}); }
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return reply(400,{error:'JSON inválido.'});
    if (Buffer.byteLength(JSON.stringify(body)) > 65536) return reply(413,{error:'Requisição muito grande.'});
    const result = simulation.createSimulation(body);
    try { await require('../lib/visitors.js').recordPix(req, result, body.items); } catch (_) {}
    return reply(201,result);
  } catch (error) {
    return reply(error instanceof simulation.SimulationError ? error.status : 500,
      {error:error instanceof simulation.SimulationError ? error.message : 'O simulador está indisponível.'});
  }
};
