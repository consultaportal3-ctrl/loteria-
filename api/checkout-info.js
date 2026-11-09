'use strict';
const {ApiError, endpoint, requireMethod, json, businessConfig} = require('../lib/api-bootstrap.js');
const payments = require('../lib/blackcat-payments.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'GET');
  const direct = require('../lib/direct-pix.js');
  const directSettings = await direct.settings();
  if (directSettings?.enabled) return json(res, direct.info(directSettings));
  if (process.env.BLACKCAT_MODE !== 'live') {
    if (process.env.VERCEL_ENV === 'production') throw new ApiError(503, 'O PIX real ainda não está ativado. O responsável pela loja precisa configurar BLACKCAT_MODE=live e as credenciais na Vercel e publicar novamente.');
    return json(res, require('../lib/blackcat-simulation.cjs').info());
  }
  payments.config();
  const business = businessConfig();
  await payments.command('PING');
  await payments.verifySeller(business);
  json(res, {...business, simulation:false, environment:'live', fulfillmentStatus:'awaiting_registration'});
});
