'use strict';
// Local browser regression checks. No external gateway or real customer data.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff','.webp':'image/webp'};
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
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
  await run('fan delivery demo validates fields without saving or sending data',async()=>{
    await navigate('/index.html');
    await evaluate('localStorage.setItem("vasco-pg-fan-cart-v1",JSON.stringify({product:"ventilador",quantity:1}))');
    await navigate('/checkout-loja.html');
    const initialStorage=await evaluate('JSON.stringify({...localStorage})');
    await evaluate('document.getElementById("preview-delivery").click()');
    check(await evaluate('document.getElementById("delivery-review").hidden && document.getElementById("delivery-feedback").textContent.length>0'),'Missing address accepted');
    await evaluate('window.deliveryRequests=0;window.fetch=()=>{deliveryRequests++;throw Error("Unexpected delivery request")};for(const [id,value] of Object.entries({name:"Pessoa Ficticia",cep:"00000-000",city:"Cidade Exemplo",street:"Rua Exemplo",number:"123",district:"Bairro Exemplo",state:"SP"}))document.getElementById("delivery-"+id).value=value;document.getElementById("preview-delivery").click()');
    check(await evaluate('!document.getElementById("delivery-review").hidden && document.getElementById("delivery-review-name").textContent==="Pessoa Ficticia" && window.deliveryRequests===0'),'Address preview failed or sent a request');
    check(await evaluate('JSON.stringify({...localStorage})')===initialStorage,'Address was persisted');
    await evaluate('document.getElementById("clear-delivery").click()');
    check(await evaluate('document.getElementById("delivery-name").value==="" && document.getElementById("delivery-review").hidden'),'Clear address failed');
    await evaluate('document.getElementById("delivery-name").value="Pessoa Ficticia"');
    await navigate('/checkout-loja.html');
    check(await evaluate('document.getElementById("delivery-name").value===""'),'Address retained after reload');
  });
  await run('fan cart persists quantities and checkout remains nonpayable',async()=>{
    await navigate('/index.html');
    await evaluate('localStorage.removeItem("vasco-pg-fan-cart-v1");document.getElementById("quantity").value="2";document.getElementById("add-to-cart").click()');
    await until('location.pathname.endsWith("carrinho-loja.html") && document.readyState==="complete" && !!document.querySelector("[data-cart-total]")');
    check(await evaluate('document.querySelector("[data-cart-count]").textContent==="2" && document.querySelector("[data-cart-total]").textContent.includes("126,00")'),'Added quantity or subtotal incorrect');
    await evaluate('document.getElementById("cart-increase").click()');
    await navigate('/carrinho-loja.html');
    check(await evaluate('document.getElementById("cart-quantity").value==="3" && document.querySelector("[data-cart-total]").textContent.includes("189,00")'),'Cart did not persist');
    await evaluate('document.getElementById("cart-quantity").value="0";document.getElementById("cart-quantity").dispatchEvent(new Event("change"))');
    check(await evaluate('document.getElementById("cart-quantity").value==="3"'),'Invalid quantity changed cart');
    await navigate('/checkout-loja.html');
    check(await evaluate('document.querySelector("[data-cart-total]").textContent.includes("189,00") && document.querySelector(".order-summary button").disabled'),'Checkout is inconsistent or payment enabled');
    for(const width of [320,390,768,1280]){
      await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<650});
      for(const page of ['/index.html','/carrinho-loja.html','/checkout-loja.html']){
        await navigate(page);
        check(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Shop overflow: '+page+' '+width);
      }
    }
    await navigate('/carrinho-loja.html');
    await evaluate('document.getElementById("cart-remove").click()');
    check(await evaluate('!document.querySelector("[data-cart-empty]").hidden && document.querySelector("[data-cart-content]").hidden'),'Removed product still shown');
    await navigate('/checkout-loja.html');
    check(await evaluate('!document.querySelector("[data-cart-empty]").hidden && document.querySelector("[data-cart-content]").hidden'),'Empty checkout displays order');
    await evaluate('localStorage.setItem("vasco-pg-fan-cart-v1",JSON.stringify({product:"ventilador",quantity:999,unitPrice:1}))');
    await navigate('/carrinho-loja.html');
    check(await evaluate('!document.querySelector("[data-cart-empty]").hidden'),'Malformed cart accepted');
    await evaluate('localStorage.removeItem("vasco-pg-fan-cart-v1")');
  });
  await run('removed pages and APIs return 404 and preview lists only the store',async()=>{
    for(const route of ['/home.html','/carrinho.html','/painel.html','/demonstracao.html','/compra-bolao/index.html','/api/blackcat-simulation?action=checkout-info','/api/mock-webhook']){
      const response=await fetch(base+route);
      check(response.status===404,'Removed route still accessible: '+route);
    }
    await navigate('/previa.html?page=index.html&device=phone');
    check(await evaluate('Array.from(document.getElementById("page").options).map(o=>o.value).join(",")==="index.html,carrinho-loja.html,checkout-loja.html"'),'Preview contains old pages');
    await until('!!document.getElementById("preview").contentDocument?.getElementById("add-to-cart")');
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Preview overflows viewport');
  });
  await run('no uncaught browser exceptions',async()=>check(errors.length===0,JSON.stringify(errors)));
  console.log(JSON.stringify({checks,errors}));
  process.exitCode=checks.some(c=>!c.pass)?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Browser check ended'));}pending.clear();
  if(socket){try{await command('Browser.close');}catch{}socket.close();}
  if(browser)browser.kill();server.close();
});
