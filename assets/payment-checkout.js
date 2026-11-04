(() => {
  'use strict';
  const checkoutButton = document.querySelector('[data-cart-payment]');
  const finishButton = document.getElementById('finish-demo');
  if (!checkoutButton || !finishButton || !window.portalDemo) return;

  const api = name => new URL(`api/blackcat-simulation?action=${name}`, location.href).toString();
  async function jsonResponse(response, fallback) {
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('O simulador não respondeu como uma API válida. Confira a publicação da função na Vercel.');
    }
    if (!response.ok) throw new Error(result.error || fallback);
    return result;
  }

  const modal = document.createElement('dialog');
  modal.className = 'payment-checkout';
  modal.setAttribute('aria-labelledby', 'payment-title');
  modal.innerHTML = `
    <div class="payment-masthead">
      <button type="button" class="payment-back payment-close">‹ Voltar ao carrinho</button>
      <span class="payment-brand">PORTAL<br>DA SORTE</span>
      <span class="payment-demo-label">Demonstração independente</span>
    </div>
    <section class="payment-hero" aria-labelledby="payment-hero-title">
      <div class="payment-hero-inner">
        <div class="payment-hero-copy">
          <span class="payment-hero-cart">Meu carrinho · <span class="payment-cart-count">0</span></span>
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
      <p class="payment-legal" hidden></p>
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
      `${business.publicName} · ${business.legalName} (CNPJ ${business.taxId}), ${business.address}. Contato: ${business.contactEmail}. `,
    ));
    for (const [label, url] of [['Privacidade', business.privacyUrl], ['Termos', business.termsUrl]]) {
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
    error.hidden = true;
    try {
      const response = await fetch(api('checkout-info'), {credentials:'same-origin',cache:'no-store',signal});
      const info = await jsonResponse(response, 'Não foi possível carregar as informações do operador.');
      if (session !== checkoutSession || !modal.open) return;
      if (info.simulation !== true || info.environment !== 'simulation') throw new Error('Somente o simulador está disponível neste checkout.');
      renderBusiness(form.querySelector('.payment-legal'), info);
      form.querySelector('.payment-legal').hidden = false;
      checkoutReady = true;
      submit.disabled = false;
    } catch (reason) {
      if (session !== checkoutSession || signal.aborted) return;
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
  modal.querySelectorAll('.payment-close').forEach(button => button.addEventListener('click', close));
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
    modal.setAttribute('aria-labelledby', 'payment-title');
    form.hidden = false;
    renderOrderSummary(window.portalDemo.getGames());
    const count = window.portalDemo.getGames().length;
    modal.querySelector('.payment-cart-count').textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
    modal.showModal();
    modal.scrollTop = 0;
    modal.querySelector('.payment-back').focus({preventScroll:true});
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
      const response = await fetch(api('create-payment'), {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'same-origin',
        signal,
        body: JSON.stringify({
          buyer: {name:form.elements.name.value.trim(), email:form.elements.email.value.trim()},
          items,
        }),
      });
      const result = await jsonResponse(response, 'Não foi possível iniciar o pagamento de teste.');
      if (session !== checkoutSession || !modal.open) return;
      if (result.simulation !== true || result.environment !== 'simulation') throw new Error('Resposta fora do ambiente de simulação.');
      orderToken = result.orderToken;
      form.hidden = true;
      const section = modal.querySelector('.payment-result');
      section.hidden = false;
      section.querySelector('.payment-order-reference').textContent = `Pedido ${result.orderId || ''}`.trim();
      section.querySelector('.payment-operator').textContent = `Recebedor de teste: ${result.operator}`;
      section.querySelector('.payment-customer-name').textContent = form.elements.name.value.trim();
      section.querySelector('.payment-customer-email').textContent = form.elements.email.value.trim();
      section.querySelector('.payment-result-total').textContent = `Total do pedido: ${money(result.amount / 100)}`;
      renderBusiness(section.querySelector('.payment-legal'), result);
      section.querySelector('.payment-legal').hidden = false;
      section.querySelector('.payment-qr').src = result.qrCodeImage;
      section.querySelector('.payment-code').value = result.qrCode;
      section.querySelector('.payment-copy').textContent = 'Copiar código de simulação';
      section.querySelector('.payment-status').textContent = 'Simulação criada. Aguardando resultado simulado…';
      section.querySelector('.payment-expiry').textContent = result.expiresAt ? `Expira em ${new Date(result.expiresAt).toLocaleString('pt-BR')}` : '';
      modal.setAttribute('aria-labelledby', 'payment-result-title');
      section.querySelector('#payment-result-title').focus({preventScroll:true});
      section.scrollIntoView({block:'start'});
      pollTimer = window.setInterval(() => checkStatus(session), 3000);
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
      const response = await fetch(`${api('payment-status')}&token=${encodeURIComponent(orderToken)}`, {credentials:'same-origin',cache:'no-store',signal});
      const result = await jsonResponse(response, 'Não foi possível consultar o pedido.');
      if (session !== checkoutSession || !modal.open) return;
      if (result.simulation !== true || result.environment !== 'simulation') throw new Error('Resposta fora do ambiente de simulação.');
      const status = modal.querySelector('.payment-status');
      status.textContent = ({
        simulated_paid:'Simulação concluída: aprovação fictícia. Nenhuma cobrança ou aposta foi realizada. O carrinho foi mantido.',
        simulated_rejected:'Recusa simulada. O carrinho foi mantido.',
        simulated_cancelled:'Cancelamento simulado. O carrinho foi mantido.',
        simulated_expired:'Expiração simulada. O carrinho foi mantido.',
        simulated_pending:'Aguardando resultado simulado. Nenhuma cobrança real foi criada.',
      })[result.status] || `Status do pedido: ${result.status}`;
      if (['simulated_paid','simulated_rejected','simulated_cancelled','simulated_expired'].includes(result.status)) {
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
