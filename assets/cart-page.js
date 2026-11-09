(() => {
  const dialog=document.getElementById('cart-dialog');
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
