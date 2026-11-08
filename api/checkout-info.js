'use strict';
const {endpoint, requireMethod, json, businessConfig} = require('../lib/api-bootstrap.js');
const payments = require('../lib/blackcat-payments.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'GET');
  if (process.env.BLACKCAT_MODE !== 'live') return json(res, require('../lib/blackcat-simulation.cjs').info());
  payments.config();
  const business = businessConfig();
  await payments.command('PING');
  await payments.verifySeller(business);
  json(res, {...business, simulation:false, environment:'live', fulfillmentStatus:'awaiting_registration'});
});
