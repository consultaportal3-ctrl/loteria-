'use strict';
const {endpoint, requireMethod, requireSameOrigin, readJson, json} = require('../lib/api-bootstrap.js');
const visitors = require('../lib/visitors.js');
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'POST');
  requireSameOrigin(req);
  const input = await readJson(req);
  if (input.action === 'leave') await visitors.leave(req, input);
  else await visitors.heartbeat(req, res, input);
  return json(res, {ok:true});
});
