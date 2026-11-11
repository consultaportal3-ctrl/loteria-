'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const store = require('../lib/redis-store.js');
const access = require('../lib/ip-access.js');
const admin = require('../api/pix-settings.js');

test('IP controls validate addresses, protect administration, expire blocks and enforce page limits', async () => {
  const original = {command:store.command,get:store.get,configured:store.configured,now:Date.now,vercel:process.env.VERCEL};
  const blocks = new Map(), traffic = new Map(), index = new Map(), rates = new Map();
  let settings = null, now = 1800000000000;
  const token = 'a'.repeat(64), session = 'directpix:session:' + createHash('sha256').update(token).digest('hex');
  process.env.VERCEL='1'; Date.now=()=>now; store.configured=()=>true;
  store.get=async key=>key===session?{authenticated:true,csrf:'valid-csrf'}:settings;
  store.command=async(command,...args)=>{
    if(command==='HSET'){assert.equal(args[0],'security:ip-blocks');blocks.set(args[1],args[2]);return 1;}
    if(command==='HDEL'){assert.equal(args[0],'security:ip-blocks');blocks.delete(args[1]);return 1;}
    if(command==='SET'){assert.equal(args[0],'security:ip-settings');settings=JSON.parse(args[1]);return 'OK';}
    if(command==='HVALS')return [...blocks.values()];
    if(command==='ZREVRANGE')return [...index].sort((a,b)=>b[1]-a[1]).slice(0,100).map(([key])=>key);
    if(command==='HMGET')return args.slice(1).map(key=>traffic.get(key));
    if(command==='EVAL'){
      assert(args[0].includes('ip-access-check'));
      const [,blockKey,trafficKey,indexKey,settingsKey,rateKey,ip,time,page,countPage,fallback,minute]=args.slice(1);
      let block=blocks.has(ip)?JSON.parse(blocks.get(ip)):null;
      const record=traffic.has(ip)?JSON.parse(traffic.get(ip)):{ip,total:0,denied:0};
      if(block?.expiresAt && block.expiresAt<=time){blocks.delete(ip);block=null;}
      const config=settings||JSON.parse(fallback);
      if(countPage==='1'&&!block){const count=(rates.get(rateKey)||0)+1;rates.set(rateKey,count);record.minute=Number(minute);record.minuteCount=count;record.total++;
        if(config.automatic&&count>config.maxRequests){block={ip,createdAt:Number(time),expiresAt:Number(time)+config.durationMinutes*60000,automatic:true,reason:'limit'};blocks.set(ip,JSON.stringify(block));}}
      if(block)record.denied++;
      if(countPage==='1'||block){record.lastSeen=Number(time);record.page=page;traffic.set(ip,JSON.stringify(record));index.set(ip,Number(time));}
      return JSON.stringify(block?{allowed:false,automatic:block.automatic,expiresAt:block.expiresAt}:{allowed:true});
    }
    throw Error('Unexpected '+command);
  };
  const req = ip=>({headers:{'x-forwarded-for':ip}});
  async function request(method,action,data={},authorized=true,csrf='valid-csrf'){
    const request={method,url:'/api/pix-settings?action='+action,headers:{host:'shop.test',origin:'https://shop.test','x-forwarded-proto':'https','content-type':'application/json','x-forwarded-for':'203.0.113.1',...(authorized?{cookie:'pix_admin='+token}:{})},body:{...data,action,csrf}};
    const headers={},res={setHeader:(key,value)=>{headers[key]=value;},end:value=>{res.data=JSON.parse(value);}};
    await admin(request,res);return {status:res.statusCode,data:res.data,headers};
  }
  try {
    assert.equal(access.normalizeIp('2001:0DB8:0:0:0:0:0:1'),'2001:db8::1');
    assert.equal(access.normalizeIp('::ffff:192.0.2.10'),'192.0.2.10');
    assert.equal(access.normalizeIp('0:0:0:0:0:ffff:c000:20a'),'192.0.2.10');
    assert.equal(access.normalizeIp('fe80::1%eth0'),'');
    assert.equal(access.normalizeIp('192.0.2.0/24'),'');
    assert.equal(access.normalizeIp('not-an-ip'),'');
    delete process.env.VERCEL;
    assert.equal(access.clientIp({headers:{'x-forwarded-for':'198.51.100.1'},socket:{remoteAddress:'127.0.0.1'}}),'127.0.0.1','untrusted local forwarding headers are ignored');
    process.env.VERCEL='1';
    assert.equal((await request('GET','security',{},false)).status,401);
    assert.equal((await request('POST','block-ip',{ip:'198.51.100.2',durationMinutes:15},true,'wrong')).status,403);
    assert.equal((await request('POST','block-ip',{ip:'203.0.113.1',durationMinutes:15})).status,422,'own IP cannot be blocked manually');
    assert.equal((await request('POST','block-ip',{ip:'198.51.100.2/24',durationMinutes:15})).status,422);
    assert.equal((await request('POST','save-security',{settings:{automatic:true,maxRequests:1,durationMinutes:5}})).status,422);
    assert.equal((await request('POST','block-ip',{ip:'198.51.100.2',durationMinutes:15,reason:'repeated requests'})).status,200);
    assert.equal((await access.inspect(req('198.51.100.2'),'/home.html')).allowed,false);
    assert.equal((await access.inspect(req('198.51.100.2'),'/api/create-payment',false)).allowed,false,'blocked IP cannot bypass via payment API');
    assert.equal((await access.inspect(req('198.51.100.2'),'/painel.html')).allowed,true,'administrator can always reach panel');
    assert.equal((await access.inspect(req('198.51.100.2'),'/api/pix-settings')).allowed,true,'admin login remains accessible');
    assert.equal((await access.inspect(req('198.51.100.2'),'/api/webhook')).allowed,true,'gateway webhooks unaffected');
    let result=await request('GET','security');assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(result.data.blocks.length,1);assert.equal(result.data.traffic[0].denied,2);
    now+=900001;assert.equal((await access.inspect(req('198.51.100.2'),'/home.html')).allowed,true,'temporary blocks expire');
    await request('POST','block-ip',{ip:'198.51.100.3',durationMinutes:0});
    now+=86400000;assert.equal((await access.inspect(req('198.51.100.3'),'/home.html')).allowed,false,'permanent block persists');
    await request('POST','unblock-ip',{ip:'198.51.100.3'});assert.equal((await access.inspect(req('198.51.100.3'),'/home.html')).allowed,true);
    await request('POST','save-security',{settings:{automatic:true,maxRequests:10,durationMinutes:5}});
    for(let i=0;i<10;i++)assert.equal((await access.inspect(req('198.51.100.4'),'/home.html')).allowed,true);
    let limit=await access.inspect(req('198.51.100.4'),'/home.html');assert.equal(limit.allowed,false);assert.equal(limit.automatic,true);
    now+=300001;assert.equal((await access.inspect(req('198.51.100.4'),'/home.html')).allowed,true,'automatic limit expires');
    await request('POST','save-security',{settings:{automatic:false,maxRequests:10,durationMinutes:5}});
    for(let i=0;i<15;i++)assert.equal((await access.inspect(req('198.51.100.5'),'/home.html')).allowed,true,'automatic blocking can be disabled');
    result=await request('GET','security');assert.equal(result.data.settings.automatic,false);assert.equal(result.data.currentIp,'203.0.113.1');
  } finally {store.command=original.command;store.get=original.get;store.configured=original.configured;Date.now=original.now;if(original.vercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=original.vercel;}
});

test('routing proxy rejects blocked pages and APIs without caching, while preserving admin recovery',async()=>{
  const proxy=(await import('../proxy.mjs')).default, original=access.inspect;
  let calls=0;
  access.inspect=async(req,page,countPage)=>{calls++;return {allowed:false,automatic:false,expiresAt:Date.now()+60000};};
  try{
    let response=await proxy(new Request('https://shop.test/home.html'));
    assert.equal(response.status,403);assert.match(response.headers.get('cache-control'),/no-store/);
    response=await proxy(new Request('https://shop.test/api/visitors',{method:'POST'}));assert.equal((await response.json()).accessBlocked,true);
    const before=calls;
    for(const path of ['/painel.html','/api/pix-settings','/assets/portal.js','/api/webhook'])assert.equal((await proxy(new Request('https://shop.test'+path))).headers.get('x-middleware-next'),'1');
    assert.equal(calls,before);
    access.inspect=async()=>({allowed:false,automatic:true,expiresAt:Date.now()+300000});
    response=await proxy(new Request('https://shop.test/'));assert.equal(response.status,429);assert(Number(response.headers.get('retry-after'))>0);
    access.inspect=async()=>{throw Error('Redis down');};assert.equal((await proxy(new Request('https://shop.test/'))).headers.get('x-middleware-next'),'1','storage outage does not take down the shop');
  }finally{access.inspect=original;}
});
