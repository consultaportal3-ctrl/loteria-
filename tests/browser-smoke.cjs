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
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff','.webp':'image/webp'};
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
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
  await run('fan storefront displays supplied price and keeps payment disabled',async()=>{
    await navigate('/');
    check(await evaluate('document.getElementById("subtotal").textContent.includes("63,00")'),'Incorrect product price');
    await evaluate('document.getElementById("increase").click();document.getElementById("show-summary").click()');
    check(await evaluate('document.getElementById("summary").open && document.getElementById("summary-total").textContent.includes("126,00")'),'Incorrect summary total');
    check(await evaluate('document.querySelector("#summary .primary").disabled'),'Incomplete product can be purchased');
    await evaluate('document.getElementById("close-summary").click()');
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
    check(await evaluate('window.portalDemo.getGames().length===5'),'Cart lost on reload');
  });
  await run('checkout validates and finishes simulation without deleting cart',async()=>{
    await evaluate('document.querySelector("[data-cart-payment]").click()');
    await until('document.querySelector(".payment-checkout").open && !document.querySelector(".payment-submit").disabled');
    await evaluate('const f=document.querySelector(".payment-form");f.elements.name.value="Cliente Teste";f.elements.email.value="cliente@example.invalid";f.elements.consent.checked=true;f.requestSubmit()');
    await until('!document.querySelector(".payment-result").hidden');
    await until('document.querySelector(".payment-status").textContent.includes("aprovação fictícia")');
    check(await evaluate('window.portalDemo.getGames().length===5'),'Simulation deleted the cart');
    await evaluate('document.querySelector(".payment-back").click()');
  });
  await run('closing cart restores the home heading',async()=>{
    await evaluate('window.portalCartPage.close()');await pause(150);
    check(await evaluate('document.querySelector(".hero-copy h1").textContent!=="Carrinho de Apostas"'),'Cart heading leaked into home');
  });
  await run('mobile navigation remains usable after resize',async()=>{
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
      check(cards.every(c=>Math.abs(c.width-294)<=1 && Math.abs(c.height-423)<=1),`Expected 294 x 423 px at ${width}px`);
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
