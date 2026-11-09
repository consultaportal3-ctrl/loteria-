'use strict';
// Local browser regression checks. No external gateway or real customer data.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const handler = require('../api/blackcat-simulation.js');
const root = path.resolve(__dirname,'..');
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
let delayCreatePayment = 0;
let blockCheckoutScript = false;
let liveFixture = false;
let directFixture = false;
let pixPanelFixture = false;
let pixPanelLoggedIn = false;
let savedPixPanelSettings;
let liveRequest;
const liveInfo = {simulation:false, environment:'live', publicName:'Operador Teste', legalName:'Operador Teste Ltda', taxId:'12345678000190', address:'Endereco de teste', contactEmail:'teste@example.invalid', privacyUrl:'https://example.invalid/privacy', termsUrl:'https://example.invalid/terms'};
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff','.webp':'image/webp'};
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (pixPanelFixture && url.pathname === '/api/pix-settings') {
    const reply = data => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); };
    if (req.method === 'GET') {
      if (url.searchParams.get('action') === 'session') return reply({authenticated:pixPanelLoggedIn, authConfigured:true, csrf:'browser-test-csrf'});
      if (url.searchParams.get('action') === 'settings') return reply({settings:savedPixPanelSettings || null});
      return reply({orders:[]});
    }
    let raw = ''; req.on('data', chunk => { raw += chunk; });
    return req.on('end', () => {
      const input = JSON.parse(raw);
      if (input.action === 'login') { pixPanelLoggedIn = true; return reply({authenticated:true, csrf:'browser-test-csrf'}); }
      if (input.action === 'save') { savedPixPanelSettings = input.settings; return reply({settings:savedPixPanelSettings}); }
      if (input.action === 'logout') pixPanelLoggedIn = false;
      return reply({authenticated:pixPanelLoggedIn});
    });
  }
  if (liveFixture && url.pathname.startsWith('/api/') && url.pathname !== '/api/blackcat-simulation') {
    const reply = data => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); };
    const info = {...liveInfo, provider:directFixture ? 'direct-pix' : 'blackcat', manualConfirmation:directFixture};
    if (directFixture) delete info.taxId;
    if (url.pathname === '/api/checkout-info') return reply(info);
    if (url.pathname === '/api/create-payment') {
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      return req.on('end', () => {
        liveRequest = JSON.parse(raw);
        reply({...info, orderToken:liveRequest.requestId, orderId:'FIXTURE-NOT-A-CHARGE', amount:600, operator:'Operador Teste Ltda', qrCode:'TEST-FIXTURE-NOT-PAYABLE', qrCodeImage:'assets/blackcat-simulation-qr.svg', status:directFixture ? 'awaiting_manual_confirmation' : 'pending'});
      });
    }
    if (url.pathname === '/api/payment-status') return reply({...info, status:directFixture ? 'awaiting_manual_confirmation' : 'approved', fulfillmentStatus:'awaiting_registration'});
  }
  if (url.pathname === '/api/checkout-info') return handler({...req, url:'/api/blackcat-simulation?action=checkout-info', method:'GET', headers:req.headers}, res);
  if (url.pathname === '/api/blackcat-simulation') {
    if (url.searchParams.get('action') === 'create-payment' && delayCreatePayment) return setTimeout(()=>handler(req,res),delayCreatePayment);
    return handler(req,res);
  }
  if (blockCheckoutScript && url.pathname === '/assets/payment-checkout.js') { res.writeHead(404).end(); return; }
  let filename;
  try { filename = path.resolve(root,'.'+decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (!filename.startsWith(root+path.sep) || path.relative(root,filename).split(path.sep).some(p => p.startsWith('.')) || filename.endsWith('.php')) { res.writeHead(404).end(); return; }
  fs.readFile(filename,(error,data) => { if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(filename)] || 'application/octet-stream');res.end(data); });
});
let browser, socket;
const pending = new Map();
const errors = [];
let serial = 0;
function command(method,params={}) {
  const id = ++serial;
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => {pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression) {
  for(let i=0;i<150;i++){if(await evaluate(expression))return;await pause(50);}
  throw new Error('Condition failed: '+expression);
}
let base;
async function navigate(url) {
  await command('Page.navigate',{url:base+url});
  await until('document.readyState === "complete"');
  await evaluate('document.fonts.ready');
}
function check(ok,message){if(!ok)throw new Error(message);}

(async () => {
  process.env.BLACKCAT_SIMULATION_DELAY_SECONDS='0';
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  let port = process.env.BROWSER_CDP_PORT;
  if (!port) {
    const profile = fs.mkdtempSync(path.join(root,'.portal-browser-smoke-'));
    const binary = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    browser = spawn(binary,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
    browser.on('error',error => console.error(error.message));
    for(let i=0;i<150;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{await pause(100);}}
  }
  if(!port)throw new Error('Browser debugging did not start.');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('message',event => {
    const message = JSON.parse(event.data);
    if(message.id){const entry=pending.get(message.id);if(entry){clearTimeout(entry.timer);pending.delete(message.id);message.error?entry.reject(new Error(message.error.message)):entry.resolve(message.result);}}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  });
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  await command('Page.enable');await command('Runtime.enable');
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const checks = [];
  async function run(name,fn){if(process.env.BROWSER_CHECK_FILTER && !name.includes(process.env.BROWSER_CHECK_FILTER))return;try{await fn();checks.push({name,pass:true});console.log('PASS '+name);}catch(error){checks.push({name,pass:false,error:error.message});console.log('FAIL '+name+': '+error.message);}}
  await run('welcome privacy notice has its stylesheet class',async()=>{
    await navigate('/');check(await evaluate('document.getElementById("cookie-notice").classList.contains("cookie-notice")'),'Cookie notice class is broken');
  });
  await navigate('/home.html');
  await evaluate('localStorage.setItem("site-cookie-consent-v1",JSON.stringify({necessary:true,analytics:false,advertising:false}));localStorage.removeItem("portal-demo-games-v1")');
  await navigate('/home.html');
  await run('all game routes load and return home',async()=>{
    for(const route of ['mega','facil','quina','milionaria','mania','timemania','dupla','loteca','dia','super']){
      await evaluate(`document.querySelector('[data-nav-game="${route}"]').click()`);await pause(80);
      check(await evaluate(`!document.getElementById('${route}-view').hidden`),'Hidden route: '+route);
      await command('Page.navigate',{url:base+'/home.html#inicio'});await pause(80);
    }
  });
  await run('cart persists and payment button is visible on mobile',async()=>{
    check(await evaluate('window.portalDemo.addComboPack("elas",1).ok'),'Could not add combo');
    await evaluate('window.portalDemo.openCart()');await pause(100);
    check(await evaluate('document.querySelector("[data-cart-payment]").getClientRects().length > 0'),'Hidden mobile payment button');
    await navigate('/carrinho.html');
    check(await evaluate('window.portalDemo.getGames().length===7'),'Cart lost on reload');
  });
  await run('checkout validates and finishes simulation without deleting cart',async()=>{
    await evaluate('document.querySelector("[data-cart-payment]").click()');
    await until('document.querySelector(".payment-checkout").open && !document.querySelector(".payment-submit").disabled');
    check(await evaluate('document.querySelector(".payment-live-field").getClientRects().length===0'),'Live buyer fields visible in simulation');
    await evaluate('const f=document.querySelector(".payment-form");f.elements.name.value="Cliente Teste";f.elements.email.value="cliente@example.invalid";f.elements.consent.checked=true;f.requestSubmit()');
    await until('!document.querySelector(".payment-result").hidden');
    await until('document.querySelector(".payment-status").textContent.includes("aprovação fictícia")');
    check(await evaluate('window.portalDemo.getGames().length===7'),'Simulation deleted the cart');
    await evaluate('document.querySelector(".payment-back").click()');
  });
  await run('live checkout renders required fields and distinguishes payment from ticket registration',async()=>{
    liveFixture = true;
    try {
      await navigate('/carrinho.html');
      await evaluate('document.querySelector("[data-cart-payment]").click()');
      await until('!document.querySelector(".payment-submit").disabled');
      check(await evaluate('document.querySelector(".payment-live-field").getClientRects().length>0 && document.querySelector("[name=cpf]").required'),'Live fields are not required and visible');
      check(await evaluate('document.querySelector(".payment-submit .payment-option-caption").textContent==="Gerar PIX"'),'Live button still claims simulation');
      await evaluate('(()=>{const f=document.querySelector(".payment-form");f.elements.name.value="Cliente Teste";f.elements.email.value="cliente@example.invalid";f.elements.phone.value="11999999999";f.elements.cpf.value="52998224725";f.elements.consent.checked=true;f.requestSubmit()})()');
      await until('document.querySelector(".payment-status").textContent.includes("Pagamento confirmado")');
      check(liveRequest.consent === true && typeof liveRequest.requestId === 'string' && liveRequest.buyer.phone === '11999999999', 'Missing live request fields');
      check(await evaluate('document.querySelector(".payment-status").textContent.includes("dependem do operador")'),'Payment was presented as a registered ticket');
      check(await evaluate('document.querySelector(".payment-numbers-action").hidden'), 'Direct PIX button appeared in gateway checkout');
      check(await evaluate('window.portalDemo.getGames().length===7'),'Live fixture deleted cart before ticket delivery');
      await evaluate('document.querySelector(".payment-back").click()');
    } finally { liveFixture = false; }
  });
  await run('direct PIX checkout hides gateway fields and keeps payment pending manual bank review',async()=>{
    liveFixture = true; directFixture = true;
    try {
      await navigate('/carrinho.html');
      await evaluate('if (!window.portalDemo.getGames().length) window.portalDemo.addComboPack("elas",1)');
      await navigate('/carrinho.html');
      await evaluate('document.querySelector("[data-cart-payment]").click()');
      await until('!document.querySelector(".payment-submit").disabled');
      check(await evaluate('!document.querySelector("[name=cpf]").required && document.querySelector(".payment-live-field").getClientRects().length===0'), 'Direct PIX still requires gateway customer fields');
      check(await evaluate('document.querySelector(".payment-consent").textContent.includes("manualmente")'), 'Manual payment review is not explained');
      await evaluate('(()=>{const f=document.querySelector(".payment-form");f.elements.name.value="Cliente Teste";f.elements.email.value="cliente@example.invalid";f.elements.consent.checked=true;f.requestSubmit()})()');
      await until('document.querySelector(".payment-status").textContent.includes("Pagamento aguardando conferência da loja")');
      check(liveRequest.buyer.cpf === undefined && liveRequest.buyer.phone === undefined, 'Direct PIX sent unnecessary document data');
      check(await evaluate('window.portalDemo.getGames().length===7'), 'Direct PIX removed the cart before bank review');
      check(await evaluate('!document.querySelector(".payment-legal").textContent.includes("undefined")'), 'Missing CNPJ leaked into merchant identity');
      check(await evaluate('document.querySelector("#payment-selected-numbers").hidden'), 'Selected numbers should start collapsed');
      await evaluate('document.querySelector(".payment-show-numbers").click()');
      check(await evaluate('!document.querySelector("#payment-selected-numbers").hidden && document.querySelector(".payment-show-numbers").getAttribute("aria-expanded")==="true"'), 'Customer button did not reveal the order summary');
      const selected = await evaluate('Array.from(document.querySelectorAll(".payment-selected-items li")).map(row=>({name:row.querySelector("strong").textContent,numbers:row.querySelector("p").textContent}))');
      check(selected.length===liveRequest.items.length && selected.every((row,i)=>row.name===liveRequest.items[i].name && row.numbers.split(' | ')[0]===liveRequest.items[i].numbers.map(n=>String(n).padStart(2,'0')).join(' · ')), 'Revealed numbers differ from the PIX order');
      check(await evaluate('document.querySelector(".payment-status").textContent.includes("Pagamento aguardando conferência da loja")'), 'Customer click approved payment');
      check(await evaluate('document.querySelector("#payment-selected-numbers").textContent.includes("não emite bilhete oficial")'), 'Summary presented as an official ticket');
      await evaluate('document.querySelector(".payment-back").click();document.querySelector("[data-cart-payment]").click()');
      await until('!document.querySelector(".payment-submit").disabled');
      check(await evaluate('document.querySelector("#payment-selected-numbers").hidden && document.querySelector(".payment-selected-items").children.length===0'), 'Previous order numbers leaked into a new checkout');
      await evaluate('document.querySelector(".payment-back").click()');
    } finally { liveFixture = false; directFixture = false; }
  });
  await run('back and forward restore all lottery pages without cart history loops',async()=>{
    const routes=[['mega','mega-sena'],['virada','mega-da-virada'],['facil','lotofacil'],['quina','quina'],['milionaria','mais-milionaria'],['mania','lotomania'],['timemania','timemania'],['dupla','dupla-sena'],['loteca','loteca'],['dia','dia-de-sorte'],['super','super-sete']];
    for(const width of [390,1366]){
      await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<650});
      for(const [game,hash] of routes){
        await navigate('/home.html#inicio');
        await evaluate(game==='virada'?`document.querySelector('.campaign-menu a[href="#mega-da-virada"]').click()`:`document.querySelector('[data-nav-game="${game}"]').click()`);
        const view=game==='virada'?'mega':game;
        await until(`location.hash==='#${hash}' && !document.getElementById('${view}-view').hidden`);
        const heading=await evaluate('document.querySelector(".hero-copy h1").textContent');
        if(game==='mega')await evaluate('document.querySelector("#mega-numbers button").click();document.getElementById("mega-repeats").value="6";document.getElementById("mega-repeats").dispatchEvent(new Event("change"))');
        await evaluate('window.portalDemo.openCart()');
        await until('location.hash==="#carrinho" && document.getElementById("cart-dialog").open');
        await evaluate('history.back()');
        await until(`location.hash==='#${hash}' && !document.getElementById('${view}-view').hidden && !document.getElementById('cart-dialog').open`);
        check(await evaluate(`document.querySelector('.hero-copy h1').textContent===${JSON.stringify(heading)}`),'Wrong heading after browser Back: '+hash);
        if(game==='mega')check(await evaluate('document.querySelector("#mega-numbers button").getAttribute("aria-pressed")==="true" && document.getElementById("mega-repeats").value==="6"'),'Back lost selected Mega-Sena numbers or repeats');
        await evaluate('history.forward()');
        await until('location.hash==="#carrinho" && document.getElementById("cart-dialog").open');
        await evaluate('document.querySelector("#cart-dialog [data-close=cart-dialog]").click()');
        await until(`location.hash==='#${hash}' && !document.getElementById('${view}-view').hidden`);
        await evaluate('history.back()');
        await until('location.hash==="#inicio" && !document.getElementById("modalidades").hidden');
        check(await evaluate('!document.getElementById("cart-dialog").open && document.querySelectorAll(".mega-page:not([hidden])").length===0'),'A lottery or cart leaked into home: '+hash);
        check(await evaluate('document.querySelector(".hero-copy h1").textContent==="Loterias Online da CAIXA"'),'Home heading not restored: '+hash);
      }
      await navigate('/carrinho.html');
      await evaluate('window.portalCartPage.close()');
      await until('!document.getElementById("cart-dialog").open && !document.getElementById("modalidades").hidden');
      check(await evaluate('document.querySelector(".hero-copy h1").textContent==="Loterias Online da CAIXA"'),'Direct cart entry restored an outdated home heading');
    }
  });
  await run('back navigation between lottery pages restores the correct form',async()=>{
    const routes=[['virada','mega-da-virada','Mega da Virada'],['mega','mega-sena','Mega-Sena'],['facil','lotofacil','Lotofácil'],['quina','quina','Quina'],['milionaria','mais-milionaria','+Milionária'],['mania','lotomania','Lotomania'],['timemania','timemania','Timemania'],['dupla','dupla-sena','Dupla Sena'],['loteca','loteca','Loteca'],['dia','dia-de-sorte','Dia de Sorte'],['super','super-sete','Super Sete']];
    for(const width of [390,1366]){
      await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<650});
      await navigate('/home.html#inicio');
      for(const [game,hash] of routes){
        await evaluate(game==='virada'?`document.querySelector('.campaign-menu a[href="#mega-da-virada"]').click()`:`document.querySelector('[data-nav-game="${game}"]').click()`);
        await until(`location.hash==='#${hash}'`);
      }
      for(let i=routes.length-2;i>=0;i--){
        const [game,hash,title]=routes[i];
        await evaluate('history.back()');
        await until(`location.hash==='#${hash}' && !document.getElementById('${game==='virada'?'mega':game}-view').hidden`);
        check(await evaluate(`document.querySelector('.hero-copy h1').textContent===${JSON.stringify(title)}`),'Wrong lottery heading after Back: '+hash);
        check(await evaluate('document.querySelectorAll(".mega-page:not([hidden])").length===1'),'Multiple lottery forms visible: '+hash);
      }
    }
  });
  await run('back navigation closes checkout without changing the cart',async()=>{
    await navigate('/home.html#mega-sena');
    await evaluate('if(!window.portalDemo.getGames().length)window.portalDemo.addMegaGame([1,2,3,4,5,6],1)');
    await evaluate('window.portalDemo.openCart()');
    const before=await evaluate('JSON.stringify(window.portalDemo.getGames())');
    await evaluate('document.querySelector("[data-cart-payment]").click()');
    await until('document.querySelector(".payment-checkout").open');
    await evaluate('history.back()');
    await until('location.hash==="#mega-sena" && !document.querySelector(".payment-checkout").open && !document.getElementById("mega-view").hidden');
    check(await evaluate(`JSON.stringify(window.portalDemo.getGames())===${JSON.stringify(before)}`),'Back from checkout changed the cart');
  });
  await run('back navigation preserves the selected phone product',async()=>{
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await navigate('/home.html#inicio');
    for(let index=1;index<9;index++){
      await evaluate('document.querySelector(".phone-product-next").click()');
      await until(`document.querySelector('.phone-product-position').textContent==='Produto ${index+1} de 11'`);
    }
    await evaluate('document.querySelector(".product-loteca .product-play").click()');
    await until('location.hash==="#loteca"');
    await evaluate('history.back()');
    await until('location.hash==="#inicio" && !document.getElementById("modalidades").hidden');
    await until('document.querySelector(".phone-product-position").textContent==="Produto 9 de 11"');
    check(await evaluate('!document.querySelector(".product-loteca").inert'),'Restored product cannot be clicked');
  });
  await run('closing cart restores the home heading',async()=>{
    await evaluate('window.portalCartPage.close()');await pause(150);
    check(await evaluate('document.querySelector(".hero-copy h1").textContent!=="Carrinho de Apostas"'),'Cart heading leaked into home');
  });
  await run('mobile navigation remains usable after resize',async()=>{
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate('document.getElementById("phone-menu-toggle").click()');
    check(await evaluate('document.getElementById("phone-menu-toggle").getAttribute("aria-expanded")==="true"'),'Menu did not open');
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await pause(100);
    check(await evaluate('!document.getElementById("phone-navigation-menu").inert'),'Desktop navigation remained inert');
  });
  await run('responsive pages stay within the viewport',async()=>{
    for (const width of [320,390,768,1280]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<650});
      for (const page of ['/index.html','/home.html','/carrinho.html']) {
        await navigate(page);
        const withinViewport=await evaluate('document.documentElement.scrollWidth <= innerWidth+1');
        if(!withinViewport) {
          const offenders=await evaluate('Array.from(document.body.querySelectorAll("*")).map(e=>({element:e.tagName+"#"+e.id+"."+e.className,right:Math.round(e.getBoundingClientRect().right),width:Math.round(e.getBoundingClientRect().width)})).filter(e=>e.right>innerWidth+2 && e.width>0).slice(0,15)');
          throw new Error(`Horizontal overflow: ${page} at ${width}px: ${JSON.stringify(offenders)}`);
        }
      }
    }
  });
  await run('late checkout responses cannot overwrite a reopened form',async()=>{
    await navigate('/carrinho.html');
    delayCreatePayment=700;
    await evaluate('document.querySelector("[data-cart-payment]").click()');
    await until('!document.querySelector(".payment-submit").disabled');
    await evaluate('(()=>{const f=document.querySelector(".payment-form");f.elements.name.value="Cliente Teste";f.elements.email.value="cliente@example.invalid";f.elements.consent.checked=true;f.requestSubmit()})()');
    await pause(50);
    await evaluate('document.querySelector(".payment-back").click();document.querySelector("[data-cart-payment]").click()');
    await pause(900);
    check(await evaluate('!document.querySelector(".payment-form").hidden && document.querySelector(".payment-result").hidden'),'Stale response overwrote the new checkout');
    delayCreatePayment=0;
    await evaluate('document.querySelector(".payment-back").click()');
  });
  await run('missing checkout script never deletes the cart',async()=>{
    blockCheckoutScript=true;
    await navigate('/carrinho.html');
    const before=await evaluate('window.portalDemo.getGames().length');
    check(before>0,'Expected a nonempty cart');
    await evaluate('document.querySelector("[data-cart-payment]").click()');
    check(await evaluate('window.portalDemo.getGames().length')===before,'Fallback deleted the cart when checkout failed to load');
    blockCheckoutScript=false;
  });
  await run('all combo totals match server calculation and reject overfull carts',async()=>{
    for(const kind of ['monthly','elas','chance','milionario','sorte','vip','virada']) {
      await navigate('/home.html');
      await evaluate('document.getElementById("cart-clear").click()');
      const result=await evaluate(`(async()=>{const added=window.portalDemo.addComboPack('${kind}',1);const items=window.portalDemo.getGames();const r=await fetch('/api/blackcat-simulation?action=create-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({buyer:{name:'Cliente Teste',email:'cliente@example.invalid'},items})});return {added,status:r.status,response:await r.json(),total:Math.round(items.reduce((s,i)=>s+i.referencePrice,0)*100),length:items.length,oversized:window.portalDemo.addComboPack('${kind}',100).ok}})()`);
      check(result.added.ok && result.status===201,`Combo failed: ${kind} ${JSON.stringify(result)}`);
      check(result.response.amount===result.total,`Wrong total: ${kind}`);
      check(result.length<=30 && !result.oversized,`Cart limit failed: ${kind}`);
    }
  });
  await run('PIX administration requires login and saves receiver configuration on the server',async()=>{
    pixPanelFixture = true;
    try {
      await navigate('/painel.html#pix');
      await until('Boolean(document.getElementById("direct-pix-login"))');
      await evaluate('(()=>{const f=document.getElementById("direct-pix-login");f.elements.password.value="browser-test-password-only";f.requestSubmit()})()');
      await until('Boolean(document.getElementById("direct-pix-form"))');
      await evaluate('(()=>{const f=document.getElementById("direct-pix-form");f.elements.keyType.value="email";f.elements.key.value="pix@example.invalid";f.elements.receiverName.value="TITULAR TESTE";f.elements.city.value="BRASILIA";f.elements.enabled.checked=true;f.elements.ownershipConfirmed.checked=true;f.requestSubmit()})()');
      await until('document.querySelector("#direct-pix-form [role=status]").textContent.includes("Configuração salva")');
      check(savedPixPanelSettings?.key === 'pix@example.invalid' && savedPixPanelSettings?.ownershipConfirmed === true && savedPixPanelSettings?.enabled === true, 'Receiver configuration was not submitted');
      check(await evaluate('!localStorage.getItem("pix-key") && !localStorage.getItem("admin-password")'), 'Credentials were stored in browser storage');
    } finally { pixPanelFixture = false; }
  });
  await run('main auxiliary pages load without uncaught exceptions',async()=>{
    for(const page of ['/painel.html','/previa.html','/demonstracao.html','/compra-bolao/index.html'])await navigate(page);
  });
  await run('product cards fit their content on phone screens',async()=>{
    await navigate('/home.html');
    for(const width of [320,360,390,650]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await pause(100);
      const clipped=await evaluate('Array.from(document.querySelectorAll(".product-card")).map(card=>({name:card.querySelector("h3").textContent,height:card.clientHeight,content:card.scrollHeight,bottom:card.getBoundingClientRect().bottom,buttonBottom:card.querySelector(".product-play").getBoundingClientRect().bottom})).filter(card=>card.content>card.height+1 || card.buttonBottom>card.bottom+1)');
      check(clipped.length===0,`Cards clipped at ${width}px: ${JSON.stringify(clipped)}`);
      const dimensions=await evaluate('Array.from(document.querySelectorAll(".product-card")).map(card=>({width:card.getBoundingClientRect().width,height:card.getBoundingClientRect().height,buttonBottom:card.querySelector(".product-play").getBoundingClientRect().bottom-card.getBoundingClientRect().top}))');
      check(dimensions.every(d=>d.width<=294.5 && Math.abs(d.height-423)<=1),`Reference size not applied at ${width}px`);
      for(const key of ['width','height','buttonBottom'])check(Math.max(...dimensions.map(d=>d[key]))-Math.min(...dimensions.map(d=>d[key]))<=1,`Unequal card ${key} at ${width}px: ${JSON.stringify(dimensions)}`);
    }
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate('document.querySelector(".product-mega").scrollIntoView({block:"center",inline:"center"})');await pause(150);
    const screenshot=await command('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(root,'card-preview.png'),Buffer.from(screenshot.data,'base64'));
  });
  await run('all 11 product cards have equal sizes on tablets and desktops',async()=>{
    await navigate('/home.html');
    for(const width of [768,1024,1280,1920]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});await pause(100);
      const cards=await evaluate('Array.from(document.querySelectorAll(".product-card")).map(c=>({name:c.querySelector("h3").textContent,width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height,content:c.scrollHeight,buttonBottom:c.querySelector(".product-play").getBoundingClientRect().bottom-c.getBoundingClientRect().top}))');
      check(cards.length===11,`Expected 11 cards, got ${cards.length}`);
      check(cards.every(c=>c.width>180 && c.width<=380.5 && c.height>300 && c.height<=565),`Unexpected card dimensions at ${width}px: ${JSON.stringify(cards)}`);
      if(width===768)check(cards.every(c=>Math.abs(c.width-294)<=1 && Math.abs(c.height-423)<=1),'Tablet card dimensions changed');
      if(width===1920)check(cards.every(c=>Math.abs(c.width-380)<=1 && Math.abs(c.height-564)<=1),'Desktop reference card dimensions changed');
      for(const key of ['width','height','buttonBottom'])check(Math.max(...cards.map(d=>d[key]))-Math.min(...cards.map(d=>d[key]))<=2,`Unequal ${key} at ${width}px: ${JSON.stringify(cards)}`);
      check(cards.every(c=>c.content<=c.height+2),`Cards clipped at ${width}px: ${JSON.stringify(cards)}`);
    }
  });
  await run('all 11 product cards are reachable using the phone arrows',async()=>{
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await navigate('/home.html');
    check(await evaluate('document.querySelectorAll(".product-card").length===11'),'Expected all 11 products');
    for(let index=1;index<=11;index++) {
      await until(`document.querySelector('.phone-product-position').textContent==='Produto ${index} de 11'`);
      if(index<11)await evaluate('document.querySelector(".phone-product-next").click()');
    }
    check(await evaluate('document.querySelector(".phone-product-next").disabled'),'Last card was not reachable');
    await evaluate('document.querySelector(".phone-product-prev").click()');
    await until('document.querySelector(".phone-product-position").textContent==="Produto 10 de 11"');
  });
  await run('all 11 product cards remain available when returning from the cart',async()=>{
    await navigate('/carrinho.html');
    await evaluate('window.portalCartPage.close()');await pause(100);
    check(await evaluate('document.querySelectorAll(".product-card").length===11'),'The cart page used an older catalog');
    check(await evaluate('document.querySelector(".phone-product-position").textContent.endsWith("de 11")'),'Carousel is missing after leaving the cart');
    check(await evaluate('!document.getElementById("modalidades").hidden'),'Products remain hidden after closing the cart');
  });
  await run('no uncaught browser exceptions',async()=>check(errors.length===0,JSON.stringify(errors)));
  console.log(JSON.stringify({checks,errors}));
  process.exitCode=checks.some(c=>!c.pass)?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Browser check ended'));}pending.clear();
  if(socket){try{await command('Browser.close');}catch{}socket.close();}
  if(browser)browser.kill();server.close();
});
