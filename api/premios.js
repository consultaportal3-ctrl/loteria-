'use strict';
const {endpoint, requireMethod, json} = require('../lib/api-bootstrap.js');

const sources = {mega:'megasena', quina:'quina', facil:'lotofacil', milionaria:'maismilionaria', timemania:'timemania', dupla:'duplasena', dia:'diadesorte', super:'supersete'};
let cached, expires = 0;
module.exports = endpoint(async (req, res) => {
  requireMethod(req, res, 'GET');
  if (cached && Date.now() < expires) return json(res, {prizes:cached});
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const prizes = {};
  await Promise.all(Object.entries(sources).map(async ([game, slug]) => {
    try {
      const response = await fetch(`https://servicebus2.caixa.gov.br/portaldeloterias/api/${slug}`, {signal:AbortSignal.timeout(6000), redirect:'error'});
      if (!response.ok) return;
      const data = await response.json();
      const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.dataProximoConcurso || '');
      const date = parts && `${parts[3]}-${parts[2]}-${parts[1]}`;
      if (date && date >= today && Number.isFinite(data.valorEstimadoProximoConcurso) && data.valorEstimadoProximoConcurso > 0) prizes[game] = {amount:data.valorEstimadoProximoConcurso, contest:data.numeroConcursoProximo, date};
    } catch (_) { /* uma fonte indisponível não deve impedir as demais */ }
  }));
  if (today <= '2026-12-31') prizes.virada = {amount:1000000000, contest:3100, date:'2027-01-01'};
  if (today <= '2026-11-28') prizes.loteca = {amount:1000000, contest:1285, date:'2026-11-30'};
  cached = prizes; expires = Date.now() + 60000;
  return json(res, {prizes});
});
