'use strict';
const {endpoint, requireMethod, requireSameOrigin, readJson, json} = require('../lib/api-bootstrap.js');
const visitors = require('../lib/visitors.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'POST');
  requireSameOrigin(req);
  await visitors.heartbeat(req, res, await readJson(req));
  return json(res, {ok:true});
});
