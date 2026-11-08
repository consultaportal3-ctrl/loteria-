'use strict';
const {endpoint, requireMethod, json} = require('../lib/api-bootstrap.js');
const payments = require('../lib/blackcat-payments.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'GET');
  json(res, await payments.paymentStatus(new URL(req.url, 'https://api.invalid').searchParams.get('token')));
});
