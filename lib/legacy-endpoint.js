'use strict';
const {json} = require('./api-bootstrap.js');
module.exports = (req, res) => json(res, {error:'Endpoint legado desativado. Utilize o simulador local BlackCat.', simulation:true}, 410);
