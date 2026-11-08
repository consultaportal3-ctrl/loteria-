'use strict';
const {endpoint, requireMethod, requireSameOrigin, readJson, json} = require('../lib/api-bootstrap.js');
const payments = require('../lib/blackcat-payments.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'POST');
  requireSameOrigin(req);
  json(res, await payments.createPayment(await readJson(req)), 201);
});
