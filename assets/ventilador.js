(() => {
  'use strict';
  const quantity=document.getElementById('quantity');
  const decrease=document.getElementById('decrease');
  const increase=document.getElementById('increase');
  const summary=document.getElementById('summary');
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  function update(){
    const value=Number(quantity.value);
    const count=Number.isFinite(value)?Math.max(1,Math.min(10,Math.floor(value))):1;
    quantity.value=String(count);
    document.getElementById('subtotal').textContent=money.format(count*6300/100);
    document.getElementById('summary-total').textContent=money.format(count*6300/100);
    document.getElementById('summary-quantity').textContent=String(count);
    decrease.disabled=count===1;
    increase.disabled=count===10;
  }
  quantity.addEventListener('change',update);
  decrease.addEventListener('click',()=>{quantity.value=Number(quantity.value)-1;update();});
  increase.addEventListener('click',()=>{quantity.value=Number(quantity.value)+1;update();});
  document.getElementById('show-summary').addEventListener('click',()=>{update();summary.showModal();});
  document.getElementById('close-summary').addEventListener('click',()=>summary.close());
  update();
})();
