'use strict';
const {endpoint, requireMethod, requireSameOrigin, readJson, json} = require('../lib/api-bootstrap.js');
const payments = require('../lib/blackcat-payments.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'POST');
  requireSameOrigin(req);
  const input = await readJson(req);
  const direct = require('../lib/direct-pix.js');
  const directSettings = await direct.settings();
  const result = directSettings?.enabled ? await direct.createPayment(input, directSettings) : await payments.createPayment(input);
  // A tracking outage must never turn a successfully created payment into an error.
  try { await require('../lib/visitors.js').recordPix(req, result, input.items); } catch (_) {}
  json(res, result, 201);
});
