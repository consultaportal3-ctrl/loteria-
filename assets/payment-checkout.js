(() => {
  'use strict';
  const checkoutButton = document.querySelector('[data-cart-payment]');
  const finishButton = document.getElementById('finish-demo');
  if (!checkoutButton || !finishButton || !window.portalDemo) return;

  let live = false;
  let manualPix = false;
  const api = name => new URL(name === 'checkout-info' || live ? `api/${name}` : `api/blackcat-simulation?action=${name}`, location.href).toString();
  async function jsonResponse(response, fallback) {
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('A API não respondeu corretamente. Confira a publicação das funções na Vercel.');
    }
    if (!response.ok) throw new Error(result.error || fallback);
    return result;
  }

  const modal = document.createElement('dialog');
  modal.className = 'payment-checkout';
  modal.setAttribute('aria-labelledby', 'payment-title');
  modal.innerHTML = `
    <div class="payment-masthead">
      <a class="payment-official-link" href="https://www.caixa.gov.br/" target="_blank" rel="noopener noreferrer">Ir para o site da CAIXA.</a>
      <span class="payment-brand" aria-hidden="true"></span>
      <span class="payment-demo-label">Operador independente</span>
    </div>
    <section class="payment-hero" aria-labelledby="payment-hero-title">
      <details class="payment-navigation">
        <summary><span aria-hidden="true">☰</span><span>Menu</span></summary>
        <nav aria-label="Navegação da compra">
          <button type="button" class="payment-back payment-cart-return">‹ Voltar ao carrinho</button>
          <button type="button" class="payment-go-form">Forma de Pagamento</button>
        </nav>
      </details>
      <div class="payment-hero-inner">
        <div class="payment-hero-copy">
          <div class="payment-hero-cart"><button type="button" class="payment-cart-return" aria-label="Voltar ao carrinho"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 3h3l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span class="payment-cart-count">0</span></button><button type="button" class="payment-go-form">Pagamento</button></div>
          <h2 id="payment-hero-title">Compra de<br>Apostas</h2>
          <p>Confira todas as suas apostas e escolha sua forma de pagamento.</p>
          <span class="payment-hero-notice">Ambiente de teste · sem vínculo com a CAIXA · não emite bilhetes oficiais</span>
        </div>
        <img class="payment-hero-art" src="assets/campaign-tickets.png" width="796" height="483" alt="" aria-hidden="true">
      </div>
    </section>
    <form class="payment-form">
      <header class="payment-header">
        <div><span class="payment-kicker">AMBIENTE DE TESTE</span><h2 id="payment-title" tabindex="-1">Forma de Pagamento</h2><p class="payment-intro">Para pagar suas compras, basta escolher a opção de sua preferência.</p></div>
      </header>
      <p class="payment-disclaimer">Demonstração independente, sem vínculo com a CAIXA. Simulador local BlackCat: nenhum dado é enviado ao gateway, nenhuma cobrança ou aposta é criada. Use somente nome e e-mail fictícios.</p>
      <h3 class="payment-cart-heading">Carrinho</h3>
      <div class="payment-layout">
        <section class="payment-order">
          <h3>Resumo do pedido</h3>
          <ul class="payment-order-items"></ul>
          <div class="payment-total"><span>Total do pedido</span><strong class="payment-order-total"></strong></div>
          <p class="payment-total-note">O valor final é recalculado pelo servidor antes de solicitar o PIX.</p>
        </section>
        <section class="payment-buyer">
          <h3>Dados do apostador:</h3>
          <label>Nome completo<input name="name" autocomplete="name" maxlength="100" required></label>
          <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
          <label class="payment-live-field" hidden>Telefone com DDD<input name="phone" type="tel" autocomplete="tel" maxlength="20"></label>
          <label class="payment-live-field" hidden>CPF<input name="cpf" inputmode="numeric" maxlength="14"></label>
          <label class="payment-consent"><input name="consent" type="checkbox" required>Entendi que este fluxo é uma simulação, não gera cobrança nem bilhete oficial, e estou usando dados fictícios.</label>
          <p class="payment-legal" hidden></p>
          <h3 class="payment-choice-heading">Escolha o meio de pagamento:</h3>
          <h4 class="payment-method-title">Pix</h4>
          <button type="submit" class="payment-submit payment-option" disabled><span class="payment-pix-brand"><span aria-hidden="true">❖</span> pix</span><span class="payment-option-caption">Simular PIX</span><span class="payment-option-arrow" aria-hidden="true">›</span></button>
        </section>
      </div>
      <p class="payment-error" role="alert" hidden></p>
    </form>
    <section class="payment-result" hidden>
      <header class="payment-header">
        <div><span class="payment-kicker">PEDIDO DE TESTE</span><h2 id="payment-result-title" tabindex="-1">Forma de Pagamento</h2><p class="payment-intro">Utilize o QR Code ou copie o código PIX abaixo.</p></div>
        <button type="button" class="payment-close" aria-label="Fechar">×</button>
      </header>
      <p class="payment-disclaimer">Demonstração independente, sem vínculo com a CAIXA. Simulador local BlackCat: a imagem e o código abaixo são ilustrativos e não podem ser pagos. Nenhuma aposta é concluída.</p>
      <h3 class="payment-cart-heading">Carrinho</h3>
      <div class="payment-result-panel">
      <div class="payment-option payment-pix-banner"><span class="payment-pix-brand"><span aria-hidden="true">❖</span> pix</span><span class="payment-option-caption">Ambiente de teste</span></div>
      <h3>Dados do apostador:</h3>
      <dl class="payment-customer-details"><dt>Nome:</dt><dd class="payment-customer-name"></dd><dt>E-mail:</dt><dd class="payment-customer-email"></dd></dl>
      <div class="payment-qr-card">
        <h3>Prévia ilustrativa do PIX simulado</h3>
        <img class="payment-qr" alt="Ilustração de simulação, sem valor de pagamento">
        <h3>Código de simulação</h3>
        <p class="payment-copy-help">Este código serve apenas para testar a cópia. Não é aceito em aplicativos bancários.</p>
      <label>PIX Copia e Cola<textarea class="payment-code" readonly rows="4"></textarea></label>
      <button type="button" class="payment-copy">Copiar código PIX</button>
      </div>
      <p class="payment-result-total"></p>
      <p class="payment-order-reference"></p>
      <p class="payment-operator"></p>
      <p class="payment-status" role="status" aria-live="polite">Aguardando resultado simulado…</p>
      <p class="payment-expiry"></p>
      <div class="payment-numbers-action" hidden>
        <button type="button" class="payment-show-numbers" aria-expanded="false" aria-controls="payment-selected-numbers">Já paguei — ver meus números</button>
        <section id="payment-selected-numbers" hidden aria-labelledby="payment-numbers-title">
          <h3 id="payment-numbers-title" tabindex="-1">Seus números escolhidos</h3>
          <p>Resumo do pedido. Este botão não confirma o pagamento nem o registro da aposta e não emite bilhete oficial.</p>
          <ul class="payment-selected-items"></ul>
        </section>
      </div>
      </div>
    </section>`;
  document.body.append(modal);
  const form = modal.querySelector('.payment-form');
  const error = modal.querySelector('.payment-error');
  const submit = form.querySelector('[type="submit"]');
  let pollTimer = 0;
  let orderToken = '';
  let submitting = false;
  let checkingStatus = false;
  let checkoutSession = 0;
  let sessionController = null;
  let checkoutReady = false;
  let requestId = '';

  function configureEnvironment(info) {
    live = info.environment === 'live' && info.simulation === false;
    manualPix = live && info.provider === 'direct-pix';
    modal.querySelector('.payment-status').classList.toggle('payment-status--plain', manualPix);
    if (!live && (info.environment !== 'simulation' || info.simulation !== true)) throw new Error('Ambiente de pagamento inválido.');
    form.querySelector('.payment-consent').hidden = false;
    if (!live) { submit.querySelector('.payment-option-caption').textContent = 'Simular PIX'; return; }
    modal.querySelectorAll('.payment-live-field').forEach(label => { label.hidden = manualPix; label.querySelector('input').required = !manualPix; });
    modal.querySelector('.payment-demo-label').textContent = 'Operador independente';
    modal.querySelector('.payment-hero-notice').textContent = 'Pagamento ao operador identificado abaixo. O PIX não comprova o registro da aposta.';
    modal.querySelectorAll('.payment-kicker').forEach(node => { node.textContent = 'PAGAMENTO PIX'; });
    modal.querySelectorAll('.payment-disclaimer').forEach(node => {
      node.hidden = manualPix;
      if (!manualPix) node.textContent = 'Confira os dados do recebedor no aplicativo do banco. Após o pagamento, o registro da aposta e a entrega do bilhete dependem da confirmação do operador.';
    });
    const consent = form.querySelector('.payment-consent');
    consent.lastChild.textContent = manualPix
      ? 'Entendi que este PIX vai para a chave do operador, que o recebimento será conferido manualmente no extrato e que o pagamento não comprova o registro da aposta.'
      : 'Li os termos e a política de privacidade do operador e autorizo o envio dos dados necessários à BlackCat para processar este pagamento.';
    submit.querySelector('.payment-option-caption').textContent = 'Gerar PIX';
    modal.querySelector('.payment-pix-banner .payment-option-caption').textContent = 'Pagamento PIX';
    const headings = modal.querySelectorAll('.payment-qr-card h3');
    headings[0].textContent = 'Escaneie o QR Code';
    headings[1].textContent = 'PIX Copia e Cola';
    modal.querySelector('.payment-copy-help').textContent = 'Cole o código no aplicativo do seu banco e confira o recebedor e o valor.';
    modal.querySelector('.payment-qr').alt = 'QR Code para pagamento PIX';
  }

  const money = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(value);

  function describeItem(item) {
    const details = [];
    if (Array.isArray(item.numbers)) details.push(item.numbers.map(number => String(number).padStart(2, '0')).join(' · '));
    if (Array.isArray(item.trevos)) details.push(`Trevos ${item.trevos.join(' · ')}`);
    if (Array.isArray(item.columns)) details.push(item.columns.map((digits, index) => `C${index + 1}: ${digits.join('/')}`).join(' · '));
    if (Array.isArray(item.picks)) details.push(`Palpites ${item.picks.join(' · ')}`);
    if (item.team) details.push(`Time ${item.team}`);
    if (Number.isInteger(item.month)) details.push(`Mês ${window.portalMonths[item.month]}`);
    if (item.repeats > 1) details.push(`${item.repeats} concursos`);
    return details.join(' | ') || 'Combinação selecionada';
  }

  function renderOrderSummary(items) {
    const list = form.querySelector('.payment-order-items');
    list.replaceChildren();
    items.forEach(item => {
      const row = document.createElement('li');
      const description = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = item.name;
      const detail = document.createElement('span');
      detail.textContent = describeItem(item);
      description.append(name, detail);
      const price = document.createElement('strong');
      price.className = 'payment-line-total';
      price.textContent = money(item.referencePrice);
      row.append(description, price);
      list.append(row);
    });
    form.querySelector('.payment-order-total').textContent = money(items.reduce((total, item) => total + item.referencePrice, 0));
  }

  function renderBusiness(target, business) {
    if (business.simulation === true) {
      target.textContent = business.notice;
      return;
    }
    target.replaceChildren(document.createTextNode(
      `${business.publicName} · ${business.legalName}${business.taxId ? ` (CNPJ ${business.taxId})` : ''}${business.address ? `, ${business.address}` : ''}.${business.contactEmail ? ` Contato: ${business.contactEmail}.` : ''} `,
    ));
    for (const [label, url] of [['Privacidade', business.privacyUrl], ['Termos', business.termsUrl]]) {
      try { if (new URL(url).protocol !== 'https:') continue; } catch { continue; }
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = label;
      target.append(link, document.createTextNode(' '));
    }
  }

  async function loadCheckoutInfo(session, signal) {
    submit.disabled = true;
    submit.querySelector('.payment-option-caption').textContent = 'Verificando configuração…';
    form.querySelector('.payment-consent').hidden = true;
    error.hidden = true;
    try {
      const response = await fetch(api('checkout-info'), {credentials:'same-origin',cache:'no-store',signal});
      const info = await jsonResponse(response, 'Não foi possível carregar as informações do operador.');
      if (session !== checkoutSession || !modal.open) return;
      configureEnvironment(info);
      renderBusiness(form.querySelector('.payment-legal'), info);
      form.querySelector('.payment-legal').hidden = false;
      checkoutReady = true;
      submit.disabled = false;
    } catch (reason) {
      if (session !== checkoutSession || signal.aborted) return;
      submit.querySelector('.payment-option-caption').textContent = 'PIX indisponível';
      error.textContent = reason instanceof Error ? reason.message : 'Erro inesperado ao carregar as informações do operador.';
      error.hidden = false;
    }
  }

  function close() {
    checkoutSession++;
    sessionController?.abort();
    checkoutReady = false;
    submitting = false;
    checkingStatus = false;
    clearInterval(pollTimer);
    if (modal.open) modal.close();
  }
  modal.querySelectorAll('.payment-close,.payment-cart-return').forEach(button => button.addEventListener('click', close));
  modal.querySelectorAll('.payment-go-form').forEach(button => button.addEventListener('click', () => {
    modal.querySelector('.payment-navigation').open = false;
    const heading = modal.querySelector(form.hidden ? '#payment-result-title' : '#payment-title');
    heading.scrollIntoView({block:'start'});
    heading.focus({preventScroll:true});
  }));
  window.addEventListener('hashchange',()=>{
    if(modal.open&&location.hash!=='#carrinho')close();
  });
  window.addEventListener('pagehide',close);
  modal.addEventListener('cancel', event => { event.preventDefault(); close(); });
  modal.addEventListener('click', event => {
    if (event.target === modal) close();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-cart-payment],#finish-demo');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (modal.open || window.portalDemo.getGames().length === 0) return;
    sessionController?.abort();
    sessionController = new AbortController();
    const session = ++checkoutSession;
    checkoutReady = false;
    submitting = false;
    checkingStatus = false;
    clearInterval(pollTimer);
    orderToken = '';
    error.hidden = true;
    modal.querySelector('.payment-result').hidden = true;
    modal.querySelector('.payment-numbers-action').hidden = true;
    modal.querySelector('#payment-selected-numbers').hidden = true;
    modal.querySelector('.payment-show-numbers').setAttribute('aria-expanded', 'false');
    modal.querySelector('.payment-selected-items').replaceChildren();
    modal.setAttribute('aria-labelledby', 'payment-title');
    form.hidden = false;
    modal.querySelector('.payment-navigation').open = false;
    renderOrderSummary(window.portalDemo.getGames());
    const count = window.portalDemo.getGames().length;
    modal.querySelector('.payment-cart-count').textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
    modal.showModal();
    modal.scrollTop = 0;
    modal.querySelector('.payment-official-link').focus({preventScroll:true});
    loadCheckoutInfo(session, sessionController.signal);
  }, true);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !checkoutReady || !modal.open || !form.reportValidity()) return;
    const session = checkoutSession;
    const signal = sessionController.signal;
    submitting = true;
    submit.disabled = true;
    error.hidden = true;
    try {
      const items = window.portalDemo.getGames();
      if (!items.length) throw new Error('O carrinho está vazio. Adicione uma combinação antes de continuar.');
      renderOrderSummary(items);
      if (live) {
        const cart = JSON.stringify(items);
        let previous;
        try { previous = JSON.parse(sessionStorage.getItem('payment-request') || 'null'); } catch {}
        requestId = previous?.cart === cart && typeof previous.id === 'string' ? previous.id : crypto.randomUUID();
        sessionStorage.setItem('payment-request', JSON.stringify({id:requestId, cart}));
      }
      const response = await fetch(api('create-payment'), {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'same-origin',
        signal,
        body: JSON.stringify({
          buyer: {name:form.elements.name.value.trim(), email:form.elements.email.value.trim(), ...(live && !manualPix ? {phone:form.elements.phone.value, cpf:form.elements.cpf.value} : {})},
          items, ...(live ? {requestId, consent:form.elements.consent.checked} : {}),
        }),
      });
      const result = await jsonResponse(response, 'Não foi possível iniciar o pagamento.');
      if (session !== checkoutSession || !modal.open) return;
      if (live ? result.environment !== 'live' || result.simulation !== false : result.simulation !== true || result.environment !== 'simulation') throw new Error('Resposta de pagamento em ambiente incorreto.');
      orderToken = result.orderToken;
      form.hidden = true;
      const section = modal.querySelector('.payment-result');
      section.hidden = false;
      section.querySelector('.payment-order-reference').textContent = `Pedido ${result.orderId || ''}`.trim();
      section.querySelector('.payment-operator').textContent = `${live ? 'Recebedor' : 'Recebedor de teste'}: ${result.operator}`;
      section.querySelector('.payment-customer-name').textContent = form.elements.name.value.trim();
      section.querySelector('.payment-customer-email').textContent = form.elements.email.value.trim();
      section.querySelector('.payment-result-total').textContent = `Total do pedido: ${money(result.amount / 100)}`;
      section.querySelector('.payment-qr').hidden = !result.qrCodeImage;
      if (result.qrCodeImage) section.querySelector('.payment-qr').src = result.qrCodeImage;
      section.querySelector('.payment-code').value = result.qrCode;
      section.querySelector('.payment-copy').textContent = live ? 'Copiar código PIX' : 'Copiar código de simulação';
      section.querySelector('.payment-status').textContent = live ? 'PIX criado. Aguardando pagamento…' : 'Simulação criada. Aguardando resultado simulado…';
      section.querySelector('.payment-expiry').textContent = result.expiresAt ? `Expira em ${new Date(result.expiresAt).toLocaleString('pt-BR')}` : '';
      section.querySelector('.payment-numbers-action').hidden = !manualPix;
      const selectedItems = section.querySelector('.payment-selected-items');
      selectedItems.replaceChildren();
      if (manualPix) items.forEach(item => {
        const row = document.createElement('li');
        const name = document.createElement('strong');
        name.textContent = item.name;
        const numbers = document.createElement('p');
        numbers.textContent = describeItem(item);
        row.append(name, numbers);
        selectedItems.append(row);
      });
      modal.setAttribute('aria-labelledby', 'payment-result-title');
      section.querySelector('#payment-result-title').focus({preventScroll:true});
      section.scrollIntoView({block:'start'});
      pollTimer = window.setInterval(() => checkStatus(session), live ? 10000 : 3000);
      await checkStatus(session);
    } catch (reason) {
      if (session !== checkoutSession || signal.aborted) return;
      error.textContent = reason instanceof Error ? reason.message : 'Erro inesperado ao gerar o PIX.';
      error.hidden = false;
    } finally {
      if (session === checkoutSession) {
        submitting = false;
        submit.disabled = !checkoutReady;
      }
    }
  });

  modal.querySelector('.payment-show-numbers').addEventListener('click', event => {
    if (!manualPix || !orderToken) return;
    modal.querySelector('#payment-selected-numbers').hidden = false;
    event.currentTarget.setAttribute('aria-expanded', 'true');
    modal.querySelector('#payment-numbers-title').focus();
  });

  modal.querySelector('.payment-copy').addEventListener('click', async event => {
    const code = modal.querySelector('.payment-code').value;
    try {
      await navigator.clipboard.writeText(code);
      event.currentTarget.textContent = 'Copiado';
    } catch {
      modal.querySelector('.payment-code').focus();
      modal.querySelector('.payment-code').select();
    }
  });

  async function checkStatus(session) {
    if (!orderToken || checkingStatus || session !== checkoutSession || !modal.open) return;
    const signal = sessionController.signal;
    checkingStatus = true;
    try {
      const url = new URL(api('payment-status'));
      url.searchParams.set('token', orderToken);
      const response = await fetch(url, {credentials:'same-origin',cache:'no-store',signal});
      const result = await jsonResponse(response, 'Não foi possível consultar o pedido.');
      if (session !== checkoutSession || !modal.open) return;
      if (live ? result.environment !== 'live' || result.simulation !== false : result.simulation !== true || result.environment !== 'simulation') throw new Error('Resposta de pagamento em ambiente incorreto.');
      const status = modal.querySelector('.payment-status');
      status.textContent = ({
        awaiting_manual_confirmation:'Pagamento aguardando conferência da loja.',
        manual_confirmed:'O operador confirmou manualmente o recebimento no extrato. O registro da aposta e a entrega do bilhete ainda dependem do operador.',
        approved:'Pagamento confirmado. O registro da aposta e a entrega do bilhete ainda dependem do operador. Contate-o com o número do pedido.',
        pending:'Aguardando confirmação do pagamento PIX.',
        cancelled:'Pagamento cancelado ou expirado. Consulte o operador antes de iniciar outro pedido.',
        refunded:'Pagamento reembolsado.',
        simulated_paid:'Simulação concluída: aprovação fictícia. Nenhuma cobrança ou aposta foi realizada. O carrinho foi mantido.',
        simulated_rejected:'Recusa simulada. O carrinho foi mantido.',
        simulated_cancelled:'Cancelamento simulado. O carrinho foi mantido.',
        simulated_expired:'Expiração simulada. O carrinho foi mantido.',
        simulated_pending:'Aguardando resultado simulado. Nenhuma cobrança real foi criada.',
      })[result.status] || `Status do pedido: ${result.status}`;
      if (['manual_confirmed','approved','cancelled','refunded','simulated_paid','simulated_rejected','simulated_cancelled','simulated_expired'].includes(result.status)) {
        clearInterval(pollTimer);
      }
    } catch (reason) {
      if (session !== checkoutSession || signal.aborted) return;
      modal.querySelector('.payment-status').textContent = reason instanceof Error
        ? `Falha ao atualizar status: ${reason.message}`
        : 'Erro inesperado ao atualizar o status do pedido.';
    } finally {
      if (session === checkoutSession) checkingStatus = false;
    }
  }
})();
