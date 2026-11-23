'use strict';
const {randomUUID} = require('node:crypto');
const {ApiError} = require('./api-bootstrap.js');
const store = require('./redis-store.js');
const KEY = 'pools:catalog:v1';
const games = {virada:'Mega da Virada', mega:'Mega-Sena', facil:'Lotofácil', quina:'Quina', milionaria:'+Milionária', dupla:'Dupla Sena', timemania:'Timemania', dia:'Dia de Sorte', super:'Super Sete'};
async function list() {
  const rows = await store.command('HVALS', KEY);
  return (rows || []).map(value => { try { return JSON.parse(value); } catch { return null; } }).filter(Boolean).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
async function save(input, id) {
  if (!input || !Object.hasOwn(games, input.game)) throw new ApiError(422, 'Escolha uma modalidade válida.');
  const numbers = String(input.numbers || '').split(/[\s,;]+/).filter(Boolean).map(Number);
  if (!numbers.length || numbers.length > 50 || numbers.some(n => !Number.isInteger(n) || n < 1 || n > 80) || new Set(numbers).size !== numbers.length) throw new ApiError(422, 'Informe números diferentes entre 1 e 80, separados por vírgulas.');
  const date = String(input.date || '');
  const parsed = new Date(date + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0,10) !== date) throw new ApiError(422, 'Informe uma data de sorteio válida.');
  const unlimited = input.unlimited === true;
  const total = unlimited ? null : Number(input.total), available = unlimited ? null : Number(input.available), price = Number(input.price);
  if ((!unlimited && (!Number.isInteger(total) || total < 1 || total > 10000 || !Number.isInteger(available) || available < 0 || available > total)) || !Number.isInteger(price) || price < 1 || price > 100000000) throw new ApiError(422, 'Confira o total de cotas, a disponibilidade e o valor.');
  let original;
  if (id !== undefined) {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new ApiError(422, 'Bolão inválido.');
    const raw = await store.command('HGET', KEY, id);
    if (!raw) throw new ApiError(404, 'Bolão não encontrado.');
    try { original = JSON.parse(raw); } catch { throw new ApiError(500, 'Não foi possível ler o bolão.'); }
  }
  const pool = {id:id || randomUUID(), game:input.game, numbers:numbers.sort((a,b)=>a-b), date, total, available, unlimited, price, createdAt:original?.createdAt || new Date().toISOString()};
  await store.command('HSET', KEY, pool.id, JSON.stringify(pool));
  return pool;
}
async function remove(id) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new ApiError(422, 'Bolão inválido.');
  await store.command('HDEL', KEY, id);
}
module.exports = {games, list, save, remove};
