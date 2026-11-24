'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/premios.js');

test('estimativas usam valor oficial e omitem fontes indisponíveis ou vencidas', async () => {
  const original = global.fetch;
  global.fetch = async url => {
    if (url.endsWith('/megasena')) return {ok:true, json:async()=>({dataProximoConcurso:'01/01/2099',numeroConcursoProximo:9999,valorEstimadoProximoConcurso:65000000})};
    if (url.endsWith('/quina')) return {ok:true, json:async()=>({dataProximoConcurso:'01/01/2000',numeroConcursoProximo:1,valorEstimadoProximoConcurso:1})};
    throw new Error('indisponível');
  };
  try {
    let body = '';
    const res = {setHeader(){}, end(data){body = data;}};
    await handler({method:'GET'},res);
    const result = JSON.parse(body);
    assert.equal(result.prizes.mega.amount,65000000);
    assert.equal(result.prizes.mega.contest,9999);
    assert.equal(result.prizes.quina,undefined);
  } finally { global.fetch = original; }
});
