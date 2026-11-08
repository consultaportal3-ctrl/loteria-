'use strict';
const {endpoint, requireMethod, readJson, json} = require('../lib/api-bootstrap.js');
const payments = require('../lib/blackcat-payments.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'POST');
  const secret = new URL(req.url, 'https://api.invalid').searchParams.get('secret');
  json(res, await payments.webhook(secret, await readJson(req)));
});
