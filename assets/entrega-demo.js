(() => {
  'use strict';
  // Fictitious delivery preview only. No requests, storage or form submission.
  const section=document.querySelector('.checkout-delivery');
  if(!section)return;
  section.innerHTML=`<p class="eyebrow">ENTREGA · DEMONSTRAÇÃO</p><h2>Teste os dados de entrega</h2>
    <p id="delivery-demo-notice" class="pending">Use apenas dados fictícios. Nada será enviado, salvo ou usado para entregar produtos. Não informe CPF ou dados bancários.</p>
    <fieldset class="delivery-fields" aria-describedby="delivery-demo-notice"><legend>Endereço fictício para teste</legend>
      <label class="delivery-wide">Nome fictício<input id="delivery-name" data-delivery-field autocomplete="off" maxlength="80" placeholder="Pessoa de Exemplo" required></label>
      <label>CEP fictício<input id="delivery-cep" data-delivery-field autocomplete="off" inputmode="numeric" maxlength="9" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" required></label>
      <label>Cidade fictícia<input id="delivery-city" data-delivery-field autocomplete="off" maxlength="80" placeholder="Cidade de Exemplo" required></label>
      <label class="delivery-wide">Rua fictícia<input id="delivery-street" data-delivery-field autocomplete="off" maxlength="120" placeholder="Rua de Exemplo" required></label>
      <label>Número fictício<input id="delivery-number" data-delivery-field autocomplete="off" maxlength="12" placeholder="123 ou S/N" required></label>
      <label>Bairro fictício<input id="delivery-district" data-delivery-field autocomplete="off" maxlength="80" placeholder="Bairro de Exemplo" required></label>
      <label>UF de exemplo<select id="delivery-state" data-delivery-field required><option value="">Selecione</option>${'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(state=>'<option>'+state+'</option>').join('')}</select></label>
      <label>Complemento fictício (opcional)<input id="delivery-extra" data-delivery-field autocomplete="off" maxlength="80" placeholder="Apto de exemplo"></label>
    </fieldset>
    <div class="delivery-actions"><button id="preview-delivery" class="secondary" type="button">Conferir dados fictícios</button><button id="clear-delivery" class="remove-product" type="button">Limpar campos</button></div>
    <p id="delivery-feedback" role="status" aria-live="polite"></p>
    <section id="delivery-review" class="pending" hidden><h3>Endereço de exemplo</h3><p id="delivery-review-name"></p><p id="delivery-review-address"></p><p>Prévia local. Não confirma pedido nem entrega.</p></section>
    <p>Prazo informado: 7 dias. O valor do frete e a região atendida ainda precisam ser confirmados.</p>`;
  const fields=[...section.querySelectorAll('[data-delivery-field]')];
  const review=document.getElementById('delivery-review');
  const feedback=document.getElementById('delivery-feedback');
  const value=id=>document.getElementById('delivery-'+id).value.trim();
  function hideReview(){
    review.hidden=true;
    document.getElementById('delivery-review-name').textContent='';
    document.getElementById('delivery-review-address').textContent='';
    feedback.textContent='';
  }
  function clear(){fields.forEach(field=>{field.value='';});hideReview();}
  fields.forEach(field=>field.addEventListener('input',hideReview));
  document.getElementById('preview-delivery').addEventListener('click',()=>{
    hideReview();
    const invalid=fields.find(field=>(field.required&&!field.value.trim())||!field.checkValidity());
    if(invalid){feedback.textContent='Preencha os campos obrigatórios com dados fictícios. O CEP deve conter 8 números.';invalid.focus();invalid.reportValidity();return;}
    document.getElementById('delivery-review-name').textContent=value('name');
    document.getElementById('delivery-review-address').textContent=[value('street'),value('number'),value('extra'),value('district'),value('city')+' / '+value('state'),'CEP '+value('cep')].filter(Boolean).join(' · ');
    review.hidden=false;
    feedback.textContent='Dados de exemplo conferidos apenas nesta tela. Nada foi enviado ou salvo.';
  });
  document.getElementById('clear-delivery').addEventListener('click',()=>{clear();feedback.textContent='Campos limpos.';});
  // Do not retain values if the browser restores the page from its history cache.
  window.addEventListener('pageshow',clear);
  window.addEventListener('pagehide',clear);
})();
