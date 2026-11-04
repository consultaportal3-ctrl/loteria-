(() => {
  'use strict';
  const checkoutButton = document.querySelector('[data-cart-payment]');
  const finishButton = document.getElementById('finish-demo');
  if (!checkoutButton || !finishButton || !window.portalDemo) return;

  const api = name => new URL(`api/${name}`, location.href).toString();
  async function jsonResponse(response, fallback) {
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('O servidor não respondeu como uma API válida. Verifique se o backend PHP está instalado e configurado.');
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
      <p class="payment-disclaimer">Demonstração independente, sem vínculo com a CAIXA. Ambiente de testes do Mercado Pago: nenhum bilhete oficial é emitido e nenhuma aposta é concluída. Ao prosseguir, seu nome e e-mail serão enviados ao Mercado Pago apenas para este teste.</p>
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
          <label class="payment-consent"><input name="consent" type="checkbox" required>Concordo que meus dados sejam usados neste pedido de teste e enviados ao Mercado Pago. Li as informações do operador e as políticas abaixo.</label>
          <p class="payment-legal" hidden></p>
          <h3 class="payment-choice-heading">Escolha o meio de pagamento:</h3>
          <h4 class="payment-method-title">Pix</h4>
          <button type="submit" class="payment-submit payment-option" disabled><span class="payment-pix-brand"><span aria-hidden="true">❖</span> pix</span><span class="payment-option-caption">Gerar PIX de teste</span><span class="payment-option-arrow" aria-hidden="true">›</span></button>
        </section>
      </div>
      <p class="payment-error" role="alert" hidden></p>
    </form>
    <section class="payment-result" hidden>
      <header class="payment-header">
        <div><span class="payment-kicker">PEDIDO DE TESTE</span><h2 id="payment-result-title" tabindex="-1">Forma de Pagamento</h2><p class="payment-intro">Utilize o QR Code ou copie o código PIX abaixo.</p></div>
        <button type="button" class="payment-close" aria-label="Fechar">×</button>
      </header>
      <p class="payment-disclaimer">Demonstração independente, sem vínculo com a CAIXA. PIX de teste: nenhum bilhete oficial é emitido e nenhuma aposta é concluída.</p>
      <h3 class="payment-cart-heading">Carrinho</h3>
      <div class="payment-result-panel">
      <div class="payment-option payment-pix-banner"><span class="payment-pix-brand"><span aria-hidden="true">❖</span> pix</span><span class="payment-option-caption">Ambiente de teste</span></div>
      <h3>Dados do apostador:</h3>
      <dl class="payment-customer-details"><dt>Nome:</dt><dd class="payment-customer-name"></dd><dt>E-mail:</dt><dd class="payment-customer-email"></dd></dl>
      <div class="payment-qr-card">
        <h3>Escaneie o código a seguir</h3>
        <img class="payment-qr" alt="QR Code PIX de teste">
        <h3>Ou copie este código para efetuar o pagamento de teste</h3>
        <p class="payment-copy-help">No aplicativo do banco, escolha PIX Copia e Cola e cole o código abaixo.</p>
      <label>PIX Copia e Cola<textarea class="payment-code" readonly rows="4"></textarea></label>
      <button type="button" class="payment-copy">Copiar código PIX</button>
      </div>
      <p class="payment-result-total"></p>
      <p class="payment-order-reference"></p>
      <p class="payment-operator"></p>
      <p class="payment-status" role="status" aria-live="polite">Aguardando confirmação segura do Mercado Pago…</p>
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
  let submittedCart = '';
  let submitting = false;
  let checkingStatus = false;

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

  async function loadCheckoutInfo() {
    submit.disabled = true;
    error.hidden = true;
    try {
      const response = await fetch(api('checkout-info.php'), {credentials:'same-origin',cache:'no-store'});
      const info = await jsonResponse(response, 'Não foi possível carregar as informações do operador.');
      renderBusiness(form.querySelector('.payment-legal'), info);
      form.querySelector('.payment-legal').hidden = false;
      submit.disabled = false;
    } catch (reason) {
      error.textContent = reason instanceof Error ? reason.message : 'Erro inesperado ao carregar as informações do operador.';
      error.hidden = false;
    }
  }

  function close() {
    clearInterval(pollTimer);
    modal.close();
  }
  modal.querySelectorAll('.payment-close').forEach(button => button.addEventListener('click', close));
  modal.addEventListener('cancel', () => clearInterval(pollTimer));
  modal.addEventListener('click', event => {
    if (event.target === modal) close();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-cart-payment],#finish-demo');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (window.portalDemo.getGames().length === 0) return;
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
    loadCheckoutInfo();
  }, true);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    submit.disabled = true;
    error.hidden = true;
    try {
      const items = window.portalDemo.getGames();
      if (!items.length) throw new Error('O carrinho está vazio. Adicione uma combinação antes de continuar.');
      renderOrderSummary(items);
      submittedCart = JSON.stringify(items);
      const response = await fetch(api('create-payment.php'), {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({
          buyer: {name:form.elements.name.value.trim(), email:form.elements.email.value.trim()},
          items,
        }),
      });
      const result = await jsonResponse(response, 'Não foi possível iniciar o pagamento de teste.');
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
      section.querySelector('.payment-qr').src = `data:image/png;base64,${result.qrCodeBase64}`;
      section.querySelector('.payment-code').value = result.qrCode;
      section.querySelector('.payment-status').textContent = 'PIX gerado. Aguardando confirmação segura do Mercado Pago…';
      section.querySelector('.payment-expiry').textContent = result.expiresAt ? `Expira em ${new Date(result.expiresAt).toLocaleString('pt-BR')}` : '';
      modal.setAttribute('aria-labelledby', 'payment-result-title');
      section.querySelector('#payment-result-title').focus({preventScroll:true});
      section.scrollIntoView({block:'start'});
      pollTimer = window.setInterval(checkStatus, 3000);
      await checkStatus();
    } catch (reason) {
      error.textContent = reason instanceof Error ? reason.message : 'Erro inesperado ao gerar o PIX.';
      error.hidden = false;
    } finally {
      submitting = false;
      submit.disabled = false;
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

  async function checkStatus() {
    if (!orderToken || checkingStatus) return;
    checkingStatus = true;
    try {
      const response = await fetch(`${api('payment-status.php')}?token=${encodeURIComponent(orderToken)}`, {credentials:'same-origin',cache:'no-store'});
      const result = await jsonResponse(response, 'Não foi possível consultar o pedido.');
      const status = modal.querySelector('.payment-status');
      status.textContent = ({
        approved:'Pagamento de teste confirmado pelo Mercado Pago.',
        rejected:'Pagamento recusado. O carrinho foi mantido.',
        cancelled:'Pagamento cancelado. O carrinho foi mantido.',
        expired:'PIX expirado. O carrinho foi mantido.',
        refunded:'Pagamento reembolsado.',
        charged_back:'Pagamento contestado.',
        in_process:'Pagamento em análise pelo Mercado Pago…',
        pending:'Aguardando confirmação segura do Mercado Pago…',
      })[result.status] || `Status do pedido: ${result.status}`;
      if (result.status === 'approved') {
        clearInterval(pollTimer);
        if (JSON.stringify(window.portalDemo.getGames()) === submittedCart) {
          window.portalDemo.getGames().forEach(() => window.portalDemo.removeGame(0));
        }
      } else if (['rejected','cancelled','expired','refunded','charged_back'].includes(result.status)) {
        clearInterval(pollTimer);
      }
    } catch (reason) {
      modal.querySelector('.payment-status').textContent = reason instanceof Error
        ? `Falha ao atualizar status: ${reason.message}`
        : 'Erro inesperado ao atualizar o status do pedido.';
    } finally {
      checkingStatus = false;
    }
  }
})();
