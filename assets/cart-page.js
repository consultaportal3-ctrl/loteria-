(() => {
  const dialog=document.getElementById('cart-dialog');
  const demoSection=document.getElementById('pool-demo-cart');
  const demoKey='portal-pool-demo-cart-v1';
  function renderPoolDemo(){
    let items; try{items=JSON.parse(localStorage.getItem(demoKey)||'[]');if(!Array.isArray(items))items=[];}catch(_){items=[];}
    demoSection.hidden=!items.length;
    const list=document.getElementById('pool-demo-items');list.replaceChildren();
    const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
    const table=document.createElement('table');table.className='pool-demo-table';

    const body=document.createElement('tbody');
    items.forEach((item,index)=>{const row=document.createElement('tr');['Mega da Virada',item.description+' \u00b7 '+item.quantity+' cota(s)','A confirmar',money(item.price * item.quantity)].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell);});const cell=document.createElement('td');const remove=document.createElement('button');remove.type='button';remove.textContent='Excluir';remove.className='pool-demo-remove';remove.addEventListener('click',()=>{items.splice(index,1);localStorage.setItem(demoKey,JSON.stringify(items));renderPoolDemo();});cell.append(remove);row.append(cell);body.append(row);});table.append(body);list.append(table);
    document.getElementById('pool-demo-total').textContent='Total simulado: '+money(items.reduce((sum,item)=>sum+item.price*item.quantity,0));
    if(window.portalDemo && !window.portalDemo.getGames().length) document.querySelectorAll('[data-cart-payment],#finish-demo').forEach(button=>{button.disabled=!items.length;});
  }
  renderPoolDemo();
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-cart-payment],#finish-demo');
    if(!button || !window.portalDemo || window.portalDemo.getGames().length) return;
    let items=[];try{items=JSON.parse(localStorage.getItem(demoKey)||'[]');}catch(_){}
    if(!Array.isArray(items)||!items.length)return;
    event.preventDefault();event.stopImmediatePropagation();
    const dialog=document.createElement('dialog');dialog.setAttribute('aria-labelledby','pool-demo-payment-title');dialog.style.cssText='border:0;border-radius:12px;padding:28px;max-width:420px;box-shadow:0 6px 30px #0005;color:#263b4d';
    const title=document.createElement('h2');title.id='pool-demo-payment-title';title.textContent='Pagamento de demonstra\u00e7\u00e3o';
    const note=document.createElement('p');note.textContent='Esta \u00e9 uma simula\u00e7\u00e3o. Nenhum Pix ser\u00e1 gerado, nenhum valor ser\u00e1 cobrado e nenhuma aposta ser\u00e1 registrada.';
    const close=document.createElement('button');close.type='button';close.textContent='Entendi';close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());dialog.append(title,note,close);document.body.append(dialog);dialog.showModal();
  },true);
  const hero=document.querySelector('.hero');
  hero.after(dialog);
  let returnHash=location.hash==='#carrinho'?'#modalidades':location.hash||'#inicio';
  let previousHash=location.hash;
  let returning=false;
  let silentCloses=0;
  const state=()=>history.state&&typeof history.state==='object'?history.state:{};
  function hideCart(){
    if(!dialog.open)return;
    silentCloses++;
    dialog.close();
  }
  function sync(){
    const active=location.hash==='#carrinho';
    document.body.classList.toggle('cart-route',active);
    if(active){
      const saved=state().portalCart;
      if(saved?.returnHash&&saved.returnHash!=='#carrinho')returnHash=saved.returnHash;
      document.querySelectorAll('main>.mega-page, #modalidades, #combos, #baixar-aplicativo').forEach(section=>{section.hidden=true;});
      document.querySelector('.hero-copy').hidden=false;
      document.querySelector('.campaign-art').hidden=false;
      document.querySelector('.hero-copy h1').textContent='Carrinho de Apostas';
      document.querySelector('.hero-copy p').textContent='No carrinho estão todas as apostas que você selecionou. Basta seguir os passos para finalizar e depois é só torcer.';
      document.querySelector('.campaign-tickets img').src='assets/campaign-tickets.png';
      document.querySelectorAll('.campaign-menu .active').forEach(link=>link.classList.remove('active'));
      if(!dialog.open)dialog.show();
      document.title='Loterias Online Caixa';
    }else{
      hideCart();
      returning=false;
    }
    previousHash=location.hash;
    if(active) renderPoolDemo();
  }
  function returnToGame(){
    if(location.hash!=='#carrinho'||returning)return;
    returning=true;
    hideCart();
    if(state().portalCart?.returnHash){
      history.back();
    }else{
      const oldURL=location.href;
      history.replaceState(state(),'',new URL('home.html'+returnHash,location.href));
      window.dispatchEvent(new HashChangeEvent('hashchange',{oldURL,newURL:location.href}));
    }
  }
  window.portalCartPage={open(){
    if(location.hash!=='#carrinho'){
      returnHash=location.hash||'#inicio';
      const oldURL=location.href;
      history.pushState({...state(),portalCart:{returnHash}},'','#carrinho');
      sync();
      window.dispatchEvent(new HashChangeEvent('hashchange',{oldURL,newURL:location.href}));
    }else sync();
    window.scrollTo({top:0,behavior:'instant'});
    window.dispatchEvent(new Event('scroll'));
    document.getElementById('cart-title').focus({preventScroll:true});
  },close:returnToGame};
  document.querySelector('[data-cart-payment]').addEventListener('click',()=>document.getElementById('finish-demo').click());
  document.querySelector('[data-cart-clear]').addEventListener('click',()=>document.getElementById('cart-clear').click());
  dialog.addEventListener('close',()=>{
    if(silentCloses){silentCloses--;return;}
    returnToGame();
  });
  window.addEventListener('hashchange',()=>{
    if(location.hash==='#carrinho'&&previousHash!=='#carrinho'){
      returnHash=state().portalCart?.returnHash||previousHash||'#modalidades';
      window.portalDemo.openCart();
    }else sync();
  });
  window.addEventListener('pageshow',sync);
  if(location.hash==='#carrinho')window.portalDemo.openCart();
})();
