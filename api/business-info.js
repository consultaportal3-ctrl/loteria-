'use strict';
const {endpoint, requireMethod, json, businessConfig} = require('../lib/api-bootstrap.js');
module.exports = endpoint((req, res) => {
  requireMethod(req, res, 'GET');
  json(res, businessConfig());
});
