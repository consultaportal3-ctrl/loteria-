'use strict';
const {ApiError, env} = require('./api-bootstrap.js');
function configured() {
  return Boolean((env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL')) && (env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN')));
}
async function command(...args) {
  const url = env('UPSTASH_REDIS_REST_URL') || env('KV_REST_API_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN') || env('KV_REST_API_TOKEN');
  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== 'https:' || !token) throw new Error();
    const response = await fetch(endpoint.origin, {method:'POST', redirect:'error', signal:AbortSignal.timeout(5000),
      headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, body:JSON.stringify(args)});
    const result = await response.json();
    if (!response.ok || result.error || !Object.hasOwn(result, 'result')) throw new Error();
    return result.result;
  } catch { throw new ApiError(503, 'O armazenamento está indisponível. Confira a conexão Redis do projeto na Vercel.'); }
}
async function get(key) { const value = await command('GET', key); return value ? JSON.parse(value) : null; }
module.exports = {configured, command, get};
