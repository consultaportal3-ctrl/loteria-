'use strict';
const {endpoint, requireMethod, json} = require('../lib/api-bootstrap.js');
const payments = require('../lib/blackcat-payments.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'GET');
  const token = new URL(req.url, 'https://api.invalid').searchParams.get('token');
  json(res, typeof token === 'string' && token.startsWith('DP.')
    ? await require('../lib/direct-pix.js').paymentStatus(token) : await payments.paymentStatus(token));
});
