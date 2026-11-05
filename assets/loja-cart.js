(() => {
  'use strict';
  const key='vasco-pg-fan-cart-v1';
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const valid=n=>Number.isInteger(n)&&n>=1&&n<=10;
  function read(){
    try{
      const data=JSON.parse(localStorage.getItem(key));
      return data?.product==='ventilador'&&valid(data.quantity)?data.quantity:0;
    }catch{return 0;}
  }
  function notice(message){
    const element=document.getElementById('cart-message');
    if(element)element.textContent=message;
  }
  function render(){
    const count=read();
    document.querySelectorAll('[data-cart-count]').forEach(el=>{el.textContent=String(count);});
    document.querySelectorAll('[data-cart-total]').forEach(el=>{el.textContent=money.format(count*63);});
    document.querySelectorAll('[data-cart-quantity]').forEach(el=>{if(el.tagName==='INPUT')el.value=String(count||1);else el.textContent=String(count);});
    document.querySelectorAll('[data-cart-content]').forEach(el=>{el.hidden=!count;});
    document.querySelectorAll('[data-cart-empty]').forEach(el=>{el.hidden=!!count;});
    const minus=document.getElementById('cart-decrease');
    const plus=document.getElementById('cart-increase');
    if(minus)minus.disabled=count<=1;
    if(plus)plus.disabled=count>=10;
  }
  function save(count){
    try{
      if(count===0)localStorage.removeItem(key);
      else if(valid(count))localStorage.setItem(key,JSON.stringify({product:'ventilador',quantity:count}));
      else return false;
      render();return true;
    }catch{
      notice('Não foi possível salvar o carrinho. Permita o armazenamento deste site no navegador e tente novamente.');
      return false;
    }
  }
  document.getElementById('add-to-cart')?.addEventListener('click',()=>{
    const input=document.getElementById('quantity');
    const count=Number(input.value);
    if(!valid(count)){notice('Escolha uma quantidade entre 1 e 10.');return;}
    if(read()+count>10){notice('O carrinho desta prévia permite até 10 unidades. Ajuste a quantidade no carrinho.');return;}
    if(save(read()+count))location.assign('carrinho-loja.html');
  });
  document.getElementById('cart-decrease')?.addEventListener('click',()=>{if(read()>1)save(read()-1);});
  document.getElementById('cart-increase')?.addEventListener('click',()=>{if(read()<10)save(read()+1);});
  document.getElementById('cart-remove')?.addEventListener('click',()=>{if(save(0))notice('Produto removido do carrinho.');});
  document.querySelector('input[data-cart-quantity]')?.addEventListener('change',event=>{
    const n=Number(event.target.value);
    if(!valid(n)){notice('Escolha uma quantidade inteira entre 1 e 10.');render();return;}
    save(n);
  });
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null)render();});
  window.addEventListener('pageshow',render);
  render();
})();
