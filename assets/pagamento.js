(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const section=document.querySelector('.checkout-delivery');
  section.innerHTML=`<p class="eyebrow">COMPRADOR E ENTREGA</p><h2>Dados para o pagamento</h2>
    <p>Ao gerar o PIX, seus dados serão enviados à BlackCat para processar a compra e registrar a entrega. Os campos não são salvos neste navegador.</p><p id="payment-coverage"></p>
    <form id="payment-form"><fieldset id="payment-fields" class="delivery-fields" disabled><legend>Preencha seus dados</legend>
    <label class="delivery-wide">Nome completo<input name="name" autocomplete="name" minlength="3" maxlength="100" required></label>
    <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="150" required></label>
    <label>Telefone com DDD<input name="phone" type="tel" autocomplete="tel-national" maxlength="20" required></label>
    <label>CPF<input name="cpf" inputmode="numeric" maxlength="14" required></label>
    <label>CEP<input name="zipCode" autocomplete="shipping postal-code" inputmode="numeric" maxlength="9" required></label>
    <label class="delivery-wide">Rua<input name="street" autocomplete="shipping address-line1" maxlength="120" required></label>
    <label>Número<input name="number" maxlength="20" required></label>
    <label>Complemento (opcional)<input name="complement" autocomplete="shipping address-line2" maxlength="100"></label>
    <label>Bairro<input name="neighborhood" maxlength="120" required></label>
    <label>Cidade<input name="city" autocomplete="shipping address-level2" maxlength="120" required></label>
    <label>Estado<select name="state" autocomplete="shipping address-level1" required><option value="">Selecione</option></select></label>
    </fieldset></form>`;
  const summary=document.querySelector('.order-summary');
  summary.innerHTML=`<p class="eyebrow">RESUMO</p><h2>Pagamento PIX</h2><dl><div><dt>Produtos</dt><dd data-cart-total>R$ 0,00</dd></div><div><dt>Frete por pedido</dt><dd id="payment-shipping">A confirmar</dd></div><div><dt>Total</dt><dd id="payment-total">A confirmar</dd></div></dl>
    <p class="pending" id="payment-message" role="status" aria-live="polite">Carregando disponibilidade…</p><button class="primary" id="generate-pix" form="payment-form" type="submit" disabled>Gerar PIX</button>
    <section id="pix-result" hidden><h3>PIX copia e cola</h3><p>Confira o valor e o recebedor no aplicativo do banco antes de pagar. Validade: 1 dia.</p><label for="pix-code">Código PIX</label><textarea id="pix-code" rows="5" readonly></textarea><button id="copy-pix" class="secondary" type="button">Copiar código</button><p id="payment-reference"></p><button id="check-payment" class="secondary" type="button">Consultar pagamento</button></section><a class="edit-cart" href="carrinho-loja.html">Voltar ao carrinho</a>`;
  const form=$('payment-form'), money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
  const cartKey='vasco-pg-fan-cart-v1', receiptKey='vasco-pg-pix-v1', lockKey='vasco-pg-pix-attempt-v1';
  let cfg, payment, busy=false, locked=false;
  const message=t=>{$('payment-message').textContent=t;};
  function quantity(){try{const c=JSON.parse(localStorage.getItem(cartKey));return c?.product==='ventilador' && Number.isInteger(c.quantity) && c.quantity>=1 && c.quantity<=10?c.quantity:0;}catch{return 0;}}
  async function api(url,options){
    const response=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(20000)});
    let data;try{data=await response.json();}catch{throw Error('Pagamento indisponível. Verifique a configuração do servidor.');}
    if(!response.ok)throw Object.assign(Error(data.error || 'Pagamento indisponível.'),{status:response.status});return data;
  }
  function refresh(){
    $('generate-pix').disabled=!cfg || !quantity() || busy || locked || !!payment;
    summary.querySelector('[data-cart-total]').textContent=money(6300*quantity());
    if(cfg){$('payment-shipping').textContent=money(cfg.shipping);$('payment-total').textContent=money(payment?payment.amount:cfg.unitPrice*quantity()+cfg.shipping);}
  }
  const statusText={PENDING:'Aguardando pagamento. Consulte novamente após pagar.',PAID:'Pagamento confirmado pela BlackCat. Guarde a referência da transação.',CANCELLED:'Cobrança cancelada. Consulte o vendedor.',REFUNDED:'Pagamento reembolsado.',EXPIRED:'Cobrança expirada. Consulte o vendedor.',REJECTED:'Pagamento recusado. Consulte o vendedor.'};
  function showPayment(){
    $('pix-result').hidden=false;$('pix-code').value=payment.code;
    $('payment-reference').textContent='Referência: '+payment.id+' · '+money(payment.amount);
    $('payment-fields').disabled=true;
    message('Cobrança recuperada. Clique em Consultar pagamento para verificar o status atual.');refresh();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!cfg || busy || locked || payment || !quantity() || !form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form)), digits=v=>v.replace(/\D/g,'');
    const customer={name:values.name.trim(),email:values.email.trim(),phone:digits(values.phone),cpf:digits(values.cpf)};
    const shipping=Object.fromEntries(['street','number','complement','neighborhood','city','state','zipCode'].map(k=>[k,values[k].trim()]));shipping.zipCode=digits(shipping.zipCode);
    if(!/^\d{10,11}$/.test(customer.phone) || !/^\d{11}$/.test(customer.cpf) || !/^\d{8}$/.test(shipping.zipCode)){message('Confira telefone com DDD, CPF e CEP.');return;}
    try{sessionStorage.setItem(lockKey,'pending');}catch{message('Permita o armazenamento desta aba para gerar o PIX com segurança.');return;}
    busy=true;locked=true;refresh();message('Gerando PIX. Aguarde sem fechar esta página.');
    try{
      payment=await api('/api/blackcat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quantity:quantity(),customer,shipping})});
      try{sessionStorage.setItem(receiptKey,JSON.stringify(payment));}catch{}
      form.reset();showPayment();message(statusText[payment.status] || 'Consulte o pagamento.');
    }catch(error){
      if(error.status>=400 && error.status<500){locked=false;try{sessionStorage.removeItem(lockKey);}catch{}message(error.message);}
      else message(error.message+' Consulte o vendedor antes de gerar outro PIX.');
    }
    finally{busy=false;refresh();}
  });
  $('copy-pix').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('pix-code').value);message('Código copiado. Confira o recebedor e o valor no banco.');}catch{$('pix-code').select();message('Selecione e copie o código acima.');}});
  $('check-payment').addEventListener('click',async()=>{
    if(!payment || busy)return;busy=true;$('check-payment').disabled=true;
    try{const result=await api('/api/blackcat?action=status&receipt='+encodeURIComponent(payment.receipt));message(statusText[result.status] || 'Consulte o vendedor.');}
    catch(error){message(error.message);}finally{busy=false;$('check-payment').disabled=false;}
  });
  window.addEventListener('storage',refresh);
  window.addEventListener('pageshow',()=>{form.reset();refresh();});
  window.addEventListener('pagehide',()=>form.reset());
  (async()=>{
    try{
      cfg=await api('/api/blackcat?action=config');
      $('payment-fields').disabled=false;
      for(const state of cfg.states){const option=document.createElement('option');option.value=state;option.textContent=state;form.elements.state.append(option);}
      $('payment-coverage').textContent='Estados atendidos: '+cfg.states.join(', ')+'. Frete fixo por pedido: '+money(cfg.shipping)+'.';
      document.querySelector('.preview-note').textContent='Pagamento PIX · BlackCat';
      document.querySelector('footer p').textContent='Entrega informada: 7 dias. Confirme modelo, voltagem e condições com o vendedor antes de pagar.';
      message('Confira o total e preencha seus dados para gerar o PIX.');
      try{locked=!!sessionStorage.getItem(lockKey);const saved=JSON.parse(sessionStorage.getItem(receiptKey));if(saved?.receipt && saved?.code){payment=saved;showPayment();}else if(locked)message('Existe uma tentativa de cobrança nesta aba. Consulte o vendedor antes de tentar novamente.');}catch{}
    }catch(error){document.querySelector('.preview-note').textContent='Pagamento aguardando configuração';message(error.message);}
    refresh();
  })();
})();
