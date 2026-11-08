(() => {
  const dialog=document.getElementById('cart-dialog');
  const hero=document.querySelector('.hero');
  hero.after(dialog);
  let returnHash=location.hash==='#carrinho'?'#modalidades':location.hash||'#modalidades';
  let previousHash=location.hash;
  function sync(){
    const active=location.hash==='#carrinho';
    document.body.classList.toggle('cart-route',active);
    if(active){
      document.querySelectorAll('main>.mega-page, #modalidades, #combos, #baixar-aplicativo').forEach(section=>{section.hidden=true;});
      document.querySelector('.hero-copy').hidden=false;
      document.querySelector('.campaign-art').hidden=false;
      document.querySelector('.hero-copy h1').textContent='Carrinho de Apostas';
      document.querySelector('.hero-copy p').textContent='No carrinho estão todas as apostas que você selecionou. Basta seguir os passos para finalizar e depois é só torcer.';
      document.querySelector('.campaign-tickets img').src='assets/campaign-tickets.png';
      document.querySelectorAll('.campaign-menu .active').forEach(link=>link.classList.remove('active'));
      if(!dialog.open)dialog.show();
      document.title = 'Portal da Sorte | Demonstração';
    }else if(dialog.open)dialog.close();
    previousHash=location.hash;
  }
  window.portalCartPage={open(){
    if(location.hash!=='#carrinho')returnHash=location.hash||'#modalidades';
    if(!location.pathname.endsWith('/carrinho.html')){
      try{history.replaceState(null,'',new URL('carrinho.html'+location.hash,location.href));}catch(_){/* Local file browsers may restrict history paths. */}
    }
    location.hash='carrinho';sync();
    window.scrollTo({top:0,behavior:'instant'});window.dispatchEvent(new Event('scroll'));
    document.getElementById('cart-title').focus({preventScroll:true});
  },close(){dialog.close();returnToGame();}};
  document.querySelector('[data-cart-payment]').addEventListener('click',()=>document.getElementById('finish-demo').click());
  document.querySelector('[data-cart-clear]').addEventListener('click',()=>document.getElementById('cart-clear').click());
  function returnToGame(){if(!dialog.open&&location.hash==='#carrinho'){
    try{history.replaceState(null,'',new URL('home.html'+location.hash,location.href));}catch(_){}
    location.hash=returnHash;
  }}
  dialog.addEventListener('close',returnToGame);
  dialog.querySelectorAll('[data-close="cart-dialog"]').forEach(button=>button.addEventListener('click',returnToGame));
  window.addEventListener('hashchange',()=>{
    if(location.hash==='#carrinho' && previousHash!=='#carrinho'){
      returnHash=previousHash||'#modalidades';
      window.portalDemo.openCart();
    }else sync();
  });
  if(location.hash==='#carrinho')window.portalDemo.openCart();
})();
