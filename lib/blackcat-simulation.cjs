'use strict';

// Local fixtures only. This module deliberately has no HTTP client or API key.
const {randomUUID} = require('node:crypto');
const MODE = 'simulation';
const SCENARIOS = ['paid', 'pending', 'cancelled', 'expired', 'rejected'];

class SimulationError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}
function requireSimulation(env = process.env) {
  if ((env.BLACKCAT_MODE || MODE) !== MODE) {
    throw new SimulationError('Somente o simulador BlackCat está disponível. Cobranças reais estão desativadas.', 503);
  }
}
function config(env = process.env) {
  requireSimulation(env);
  const scenario = env.BLACKCAT_SIMULATION_SCENARIO || 'paid';
  const delay = Number(env.BLACKCAT_SIMULATION_DELAY_SECONDS || 15);
  if (!SCENARIOS.includes(scenario) || !Number.isInteger(delay) || delay < 0 || delay > 600) {
    throw new SimulationError('Configuração do simulador inválida.', 503);
  }
  return {scenario, delay};
}
function info(env = process.env) {
  config(env);
  return {simulation:true, environment:MODE, provider:'blackcat-simulator',
    notice:'Simulador local BlackCat. Nenhum dado é enviado ao gateway, nenhuma cobrança ou aposta é criada. Use somente dados fictícios.'};
}
function choose(n, k) {
  let result = 1;
  for (let i = 1; i <= k; i++) result = Math.round(result * (n - i + 1) / i);
  return result;
}
function numbers(values, minCount, maxCount, min, max) {
  return Array.isArray(values) && values.length >= minCount && values.length <= maxCount
    && new Set(values).size === values.length && values.every(n => Number.isInteger(n) && n >= min && n <= max);
}
const RULES = {
  mega:[600,6,20,1,60,[1,2,3,4,6,8,9,12]], facil:[350,15,20,1,25,[1,2,3,4,6,8,9,12,18,24]],
  quina:[300,5,15,1,80,[1,3,6,12,18,24]], milionaria:[600,6,12,1,50,[1,2,3,4,5]],
  mania:[300,50,50,0,99,[1,2,3,4,6,8,9,12]], timemania:[350,10,10,1,80,[1,3,6,9,12]],
  dupla:[300,6,15,1,50,[1,2,3,4,6,8,9,12]], dia:[250,7,15,1,31,[1,3,6,9,12,18,24]],
};
const NAMES = {mega:'Mega-Sena',facil:'Lotofácil',quina:'Quina',milionaria:'+Milionária',mania:'Lotomania',
  timemania:'Timemania',dupla:'Dupla Sena',dia:'Dia de Sorte',loteca:'Loteca',super:'Super Sete'};
function priceItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) throw new SimulationError('O carrinho deve conter de 1 a 30 combinações.');
  let total = 0;
  const normalized = items.map(item => {
    if (!item || typeof item !== 'object' || !Object.hasOwn(NAMES, item.game)) throw new SimulationError('Modalidade inválida.');
    const repeats = item.repeats ?? 1;
    if (!Number.isInteger(repeats) || repeats < 1 || repeats > 24) throw new SimulationError('Quantidade de concursos inválida.');
    let amount;
    if (item.game === 'loteca') {
      if (!Array.isArray(item.picks) || item.picks.length !== 14 || !item.picks.every(p => Number.isInteger(p) && p >= 1 && p <= 7)) throw new SimulationError('Palpites da Loteca inválidos.');
      const count = p => [1,2,4].filter(bit => p & bit).length;
      const doubles = item.picks.filter(p => count(p) === 2).length;
      const triples = item.picks.filter(p => p === 7).length;
      if (repeats !== 1 || triples > 6 || doubles > [9,8,6,5,3,1,0][triples] || doubles + triples === 0) throw new SimulationError('Limites da Loteca inválidos.');
      amount = 200 * 2 ** doubles * 3 ** triples;
    } else if (item.game === 'super') {
      if (!Array.isArray(item.columns) || item.columns.length !== 7 || ![1,3,6,9,12].includes(repeats)
        || !item.columns.every(c => numbers(c,1,3,0,9))) throw new SimulationError('Colunas do Super Sete inválidas.');
      const digits = item.columns.reduce((sum,c) => sum + c.length,0);
      if ((digits <= 14 && item.columns.some(c => c.length > 2)) || (digits > 14 && item.columns.some(c => c.length < 2))) throw new SimulationError('Distribuição do Super Sete inválida.');
      amount = 300 * item.columns.reduce((product,c) => product * c.length,1) * repeats;
    } else {
      const [unit,minCount,maxCount,min,max,repeatOptions] = RULES[item.game];
      if (!repeatOptions.includes(repeats) || !numbers(item.numbers,minCount,maxCount,min,max)) throw new SimulationError('Números ou concursos inválidos.');
      amount = unit * choose(item.numbers.length,minCount) * repeats;
      if (item.game === 'milionaria') {
        if (!numbers(item.trevos,2,6,1,6)) throw new SimulationError('Trevos inválidos.');
        amount *= choose(item.trevos.length,2);
      }
      if (item.game === 'dia' && (!Number.isInteger(item.month) || item.month < 0 || item.month > 11)) throw new SimulationError('Mês inválido.');
      if (item.game === 'timemania' && (typeof item.team !== 'string' || !item.team.trim() || item.team.length > 320)) throw new SimulationError('Time do Coração inválido.');
      if (item.game === 'mega' && item.special === 'virada') amount = unit * choose(item.numbers.length,minCount);
    }
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 20000000) throw new SimulationError('Valor fora do limite.');
    total += amount;
    return {title:'Vasco PG',unitPrice:amount,quantity:1,tangible:false};
  });
  if (total < 100 || total > 20000000) throw new SimulationError('Total fora do limite permitido.');
  return {items:normalized,amount:total};
}
function requestFixture(items, externalRef) {
  const priced = priceItems(items);
  return {...priced,currency:'BRL',paymentMethod:'pix',externalRef,
    // Deliberately fictitious fixture, never transmitted to a payment provider.
    customer:{name:'Cliente de Simulação',email:'cliente@example.invalid',phone:'00000000000',document:{number:'00000000000',type:'cpf'}},
    metadata:'SIMULAÇÃO LOCAL — SEM COBRANÇA'};
}
function createSimulation(input, env = process.env, now = Date.now()) {
  const settings = config(env);
  const buyer = input?.buyer;
  if (!buyer || typeof buyer.name !== 'string' || buyer.name.trim().length < 3 || buyer.name.length > 100
    || buyer.name.trim().split(/\s+/).length < 2 || typeof buyer.email !== 'string' || buyer.email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) throw new SimulationError('Informe um nome completo e e-mail fictícios válidos para o teste.');
  const orderId = `SIM-${randomUUID()}`;
  const request = requestFixture(input.items,orderId);
  const expiresAt = now + 10 * 60 * 1000;
  // This is an UNSIGNED simulation fixture, not an authentication or payment token.
  // It contains no buyer data. No downstream consumer may treat it as a real order.
  const receipt = {v:1,id:orderId,amount:request.amount,createdAt:now,expiresAt,...settings};
  const orderToken = 'SIM.' + encodeURIComponent(JSON.stringify(receipt));
  return {...info(env),orderId,orderToken,status:'simulated_pending',amount:request.amount,
    operator:'Simulador local BlackCat — sem recebedor financeiro',
    qrCode:`SIMULACAO-SEM-VALOR:${orderId}`,qrCodeImage:'/assets/blackcat-simulation-qr.svg',
    expiresAt:new Date(expiresAt).toISOString(),
    gatewayFixture:{success:true,data:{transactionId:orderId,status:'PENDING',paymentMethod:'pix',amount:request.amount,
      paymentData:{qrCode:`SIMULACAO-SEM-VALOR:${orderId}`,copyPaste:`SIMULACAO-SEM-VALOR:${orderId}`,expiresAt:new Date(expiresAt).toISOString()}}}};
}
function simulationStatus(token, env = process.env, now = Date.now()) {
  config(env);
  if (typeof token !== 'string' || token.length > 1800 || !token.startsWith('SIM.')) throw new SimulationError('Simulação não encontrada.',404);
  let receipt;
  try { receipt = JSON.parse(decodeURIComponent(token.slice(4))); } catch { throw new SimulationError('Simulação não encontrada.',404); }
  if (!receipt || receipt.v !== 1 || !/^SIM-[a-f0-9-]{36}$/.test(receipt.id) || !Number.isSafeInteger(receipt.amount)
    || receipt.amount < 100 || receipt.amount > 20000000 || !Number.isSafeInteger(receipt.createdAt)
    || receipt.createdAt > now || receipt.expiresAt !== receipt.createdAt + 600000 || !SCENARIOS.includes(receipt.scenario)
    || !Number.isInteger(receipt.delay) || receipt.delay < 0 || receipt.delay > 600) throw new SimulationError('Recibo de simulação inválido.',404);
  const elapsed = now - receipt.createdAt;
  const outcome = now >= receipt.expiresAt ? 'expired' : elapsed >= receipt.delay * 1000 ? receipt.scenario : 'pending';
  return {...info(env),orderId:receipt.id,status:`simulated_${outcome}`,amount:receipt.amount,expiresAt:new Date(receipt.expiresAt).toISOString(),updatedAt:new Date(now).toISOString()};
}
module.exports = {SimulationError,requireSimulation,config,info,priceItems,requestFixture,createSimulation,simulationStatus};
