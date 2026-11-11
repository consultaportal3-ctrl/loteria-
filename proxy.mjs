import {next} from '@vercel/functions';
import access from './lib/ip-access.js';

export default async function proxy(request) {
  const path = new URL(request.url).pathname;
  if (access.bypass(path)) return next();
  // Asset downloads and presence polling do not count as repeated page visits.
  const countPage = request.method === 'GET' && !path.startsWith('/api/') && !/\.(?:css|js|mjs|png|jpg|jpeg|svg|ico|woff2?|webp|txt|json)$/i.test(path);
  let result;
  try { result = await access.inspect(request,path,countPage); }
  catch { return next(); } // Keep the shop available during a Redis outage.
  if (result.allowed) return next();
  const status = result.automatic ? 429 : 403;
  const message = result.automatic ? 'Muitos acessos. Aguarde para tentar novamente.' : 'O acesso a esta loja foi bloqueado.';
  const headers = {'Cache-Control':'private, no-store','Content-Type':path.startsWith('/api/') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8'};
  if (result.expiresAt) headers['Retry-After'] = String(Math.max(1,Math.ceil((result.expiresAt-Date.now())/1000)));
  return new Response(path.startsWith('/api/') ? JSON.stringify({error:message,accessBlocked:true}) : message,{status,headers});
}
