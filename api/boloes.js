'use strict';
const {endpoint, requireMethod, json} = require('../lib/api-bootstrap.js');
const pools = require('../lib/pools.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'GET');
  return json(res, {pools:await pools.list()});
});
