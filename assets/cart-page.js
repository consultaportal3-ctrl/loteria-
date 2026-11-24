(() => {
  const dialog=document.getElementById('cart-dialog');
  const demoSection=document.getElementById('pool-demo-cart');
  const demoKey='portal-pool-demo-cart-v1';
  let poolTimerInterval;
  function renderPoolDemo(){
    let items; try{items=JSON.parse(localStorage.getItem(demoKey)||'[]');if(!Array.isArray(items))items=[];}catch(_){items=[];}
    const unexpired=items.filter(item=>!Number.isFinite(item.reservedUntil)||item.reservedUntil>Date.now());
    if(unexpired.length!==items.length){items=unexpired;localStorage.setItem(demoKey,JSON.stringify(items));}
    demoSection.hidden=!items.length;
    const list=document.getElementById('pool-demo-items');list.replaceChildren();
    const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
    const table=document.createElement('table');table.className='pool-demo-table';
    const thead=document.createElement('thead'),header=document.createElement('tr');
    ['Modalidade','Detalhar apostas','Concurso','Valor da Cota','Tempo de Reserva da Cota','Excluir'].forEach(title=>{const cell=document.createElement('th');cell.scope='col';cell.textContent=title;header.append(cell);});thead.append(header);table.append(thead);
    const body=document.createElement('tbody');
    const contests={virada:'3100',mega:'3090',facil:'3837',quina:'7173',loteca:'1285',milionaria:'410',dupla:'3036',timemania:'2472',dia:'1355',super:'926'};
    let detailDialog=document.getElementById('pool-bet-details-dialog');
    if(!detailDialog){detailDialog=document.createElement('dialog');detailDialog.id='pool-bet-details-dialog';detailDialog.className='pool-bet-details-dialog';document.body.append(detailDialog);}
    items.forEach((item,index)=>{
      if(!Number.isFinite(item.reservedUntil))item.reservedUntil=Date.now()+8*60*1000;
      const row=document.createElement('tr');
      const nameCell=document.createElement('td'),name=document.createElement('strong');name.textContent=item.name||'Bolão';nameCell.append(name);
      if(item.quantity>1){const quantity=document.createElement('small');quantity.textContent=`${item.quantity} cotas`;nameCell.append(quantity);}
      const detailsCell=document.createElement('td'),details=document.createElement('button');details.type='button';details.className='pool-bet-detail-button';details.setAttribute('aria-label',`Detalhar apostas do bolão ${item.name||''}`);details.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M19 7h26l-6 11H25L19 7Zm7 11-9 15a16 16 0 0 0 14 24h2a16 16 0 0 0 14-24l-9-15M24 13h16"/><circle cx="32" cy="42" r="4"/></svg>';
      details.addEventListener('click',()=>{
        detailDialog.replaceChildren();const top=document.createElement('div');top.className='pool-bet-details-top';const title=document.createElement('h2');title.textContent=`Apostas do ${item.name||'bolão'}`;const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Fechar detalhes');close.addEventListener('click',()=>detailDialog.close());top.append(title,close);detailDialog.append(top);
        (item.bets||[]).forEach((bet,betIndex)=>{const section=document.createElement('section');section.className='pool-bet-details-row';const label=document.createElement('h3');label.textContent=`Aposta ${betIndex+1}`;const picks=document.createElement('div');picks.className='pool-bet-detail-picks';(Array.isArray(bet)?bet:[]).forEach((pick,pickIndex)=>{const chip=document.createElement('span');chip.textContent=item.game==='loteca'?`${pickIndex+1}: ${pick}`:String(pick).padStart(2,'0');picks.append(chip);});section.append(label,picks);detailDialog.append(section);});
        if(!(item.bets||[]).length){const empty=document.createElement('p');empty.textContent='As apostas ainda não foram informadas.';detailDialog.append(empty);}detailDialog.showModal();
      });detailsCell.append(details);
      const contestCell=document.createElement('td');contestCell.textContent=item.contest||contests[item.game]||'A confirmar';
      const priceCell=document.createElement('td');priceCell.textContent=money(item.price);
      const timerCell=document.createElement('td');timerCell.className='pool-reservation-time';timerCell.dataset.until=String(item.reservedUntil);
      const removeCell=document.createElement('td'),remove=document.createElement('button');remove.type='button';remove.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 9v9M14 9v9"/></svg>';remove.setAttribute('aria-label','Excluir bolão');remove.className='pool-demo-remove';remove.addEventListener('click',()=>{items.splice(index,1);localStorage.setItem(demoKey,JSON.stringify(items));renderPoolDemo();});removeCell.append(remove);
      row.append(nameCell,detailsCell,contestCell,priceCell,timerCell,removeCell);body.append(row);
    });
    table.append(body);list.append(table);localStorage.setItem(demoKey,JSON.stringify(items));
    clearInterval(poolTimerInterval);const updateTimers=()=>{if(items.some(item=>Number.isFinite(item.reservedUntil)&&item.reservedUntil<=Date.now())){items=items.filter(item=>!Number.isFinite(item.reservedUntil)||item.reservedUntil>Date.now());localStorage.setItem(demoKey,JSON.stringify(items));renderPoolDemo();return;}list.querySelectorAll('.pool-reservation-time').forEach(timer=>{const left=Math.max(0,Number(timer.dataset.until)-Date.now());timer.textContent=left?`◷ ${String(Math.floor(left/60000)).padStart(2,'0')}:${String(Math.floor(left%60000/1000)).padStart(2,'0')}`:'00:00';timer.classList.toggle('is-expired',left===0);});};updateTimers();poolTimerInterval=setInterval(updateTimers,1000);
    document.getElementById('pool-demo-total').textContent='Total dos bolões: '+money(items.reduce((sum,item)=>sum+item.price*item.quantity,0));
    if(window.portalDemo){const gameTotal=window.portalDemo.getGames().reduce((sum,item)=>sum+item.referencePrice,0);document.getElementById('cart-total').textContent=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(gameTotal+items.reduce((sum,item)=>sum+item.price*item.quantity/100,0));}
    if(window.portalDemo) document.querySelectorAll('[data-cart-payment],#finish-demo').forEach(button=>{button.disabled=!window.portalDemo.getGames().length&&!items.length;});
  }
  renderPoolDemo();
  if(new URLSearchParams(location.search).get('checkout')==='1')setTimeout(()=>document.querySelector('[data-cart-payment]')?.click(),0);
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
