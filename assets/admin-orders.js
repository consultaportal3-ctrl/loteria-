(() => {
  'use strict';
  const nav = document.querySelector('[data-section="pedidos"]');
  if (!nav) return;
  const badge = document.getElementById('orders-badge');
  const api = new URL('api/admin', location.href);
  let csrf = '';
  let refreshTimer = 0;
  let orders = [];

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  async function request(action, options = {}) {
    const url = new URL(api);
    if (options.method !== 'POST') url.searchParams.set('action', action);
    const response = await fetch(url, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: options.method === 'POST' ? {'Content-Type':'application/json'} : {},
      body: options.method === 'POST' ? JSON.stringify({...options.data, csrf}) : undefined,
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('O servidor não respondeu como uma API válida. Verifique se o backend Node.js está instalado e configurado.');
    }
    if (!response.ok) throw new Error(data.error || 'Não foi possível consultar os pedidos.');
    return data;
  }

  function showMessage(text, isError = false) {
    const host = document.getElementById('admin-orders');
    if (!host) return;
    host.replaceChildren(element('p', text, isError ? 'admin-error' : 'muted'));
  }

  function describeItem(item) {
    const details = [];
    if (Array.isArray(item.numbers)) details.push(item.numbers.join(', '));
    if (Array.isArray(item.trevos)) details.push(`Trevos: ${item.trevos.join(', ')}`);
    if (Array.isArray(item.columns)) details.push(item.columns.map((digits, index) => `C${index + 1}: ${digits.join('/')}`).join(' · '));
    if (Array.isArray(item.picks)) details.push(`Palpites: ${item.picks.join(', ')}`);
    if (item.team) details.push(`Time: ${item.team}`);
    if (Number.isInteger(item.month)) details.push(`Mês: ${item.month + 1}`);
    if (item.repeats > 1) details.push(`${item.repeats} concursos`);
    return details.length ? `${item.name}: ${details.join(' · ')}` : item.name;
  }

  function paymentStatus(status) {
    return ({
      creating:'Criando PIX',
      pending:'Aguardando pagamento',
      in_process:'Em análise',
      approved:'Aprovado',
      rejected:'Recusado',
      cancelled:'Cancelado',
      expired:'Expirado',
      refunded:'Reembolsado',
      charged_back:'Contestado',
      failed:'Falha ao criar PIX',
    })[status] || `Status: ${status}`;
  }

  async function showLogin() {
    const host = document.getElementById('admin-orders');
    host.replaceChildren();
    const card = element('section', undefined, 'card admin-login');
    card.append(element('h2', 'Acesso administrativo'), element('p', 'Entre para consultar pedidos e dados dos clientes armazenados no servidor.'));
    const form = document.createElement('form');
    const label = element('label', 'Senha administrativa');
    const password = document.createElement('input');
    password.type = 'password';
    password.name = 'password';
    password.autocomplete = 'current-password';
    password.required = true;
    label.append(password);
    const submit = element('button', 'Entrar', 'button');
    submit.type = 'submit';
    const error = element('p', '', 'admin-error');
    error.hidden = true;
    form.append(label, submit, error);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      error.hidden = true;
      try {
        const result = await request('login', {method:'POST',data:{action:'login',password:password.value}});
        csrf = result.csrf;
        await loadOrders();
      } catch (reason) {
        error.textContent = reason instanceof Error ? reason.message : 'Erro no login.';
        error.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });
    card.append(form);
    host.append(card);
    password.focus();
  }

  function renderOrders() {
    const host = document.getElementById('admin-orders');
    if (!host) return;
    host.replaceChildren();
    const card = element('section', undefined, 'card');
    const heading = element('div', undefined, 'card-heading');
    const headingText = element('div');
    headingText.append(element('h2', 'Pedidos do ambiente de testes'), element('p', `${orders.length} pedido${orders.length === 1 ? '' : 's'} · Pagamentos reais desativados`));
    const controls = element('div', undefined, 'toolbar');
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Buscar pedido, cliente ou e-mail';
    search.setAttribute('aria-label', 'Buscar pedido, cliente ou e-mail');
    const refresh = element('button', 'Atualizar', 'button secondary');
    refresh.type = 'button';
    refresh.addEventListener('click', () => loadOrders());
    const logout = element('button', 'Sair', 'button secondary');
    logout.type = 'button';
    logout.addEventListener('click', async () => {
      try {
        await request('logout', {method:'POST',data:{action:'logout'}});
        csrf = '';
        csrf = (await request('csrf')).csrf;
        await showLogin();
      } catch (reason) {
        showMessage(reason instanceof Error ? reason.message : 'Não foi possível encerrar a sessão.', true);
      }
    });
    controls.append(search, refresh, logout);
    heading.append(headingText, controls);
    card.append(heading);
    const wrapper = element('div', undefined, 'table-scroll');
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const header = document.createElement('tr');
    ['PEDIDO / DATA','CLIENTE','BILHETES / COMBINAÇÕES','VALOR','STATUS'].forEach(text => header.append(element('th', text)));
    thead.append(header);
    const tbody = document.createElement('tbody');
    table.append(thead, tbody);
    wrapper.append(table);
    card.append(wrapper);
    host.append(card);

    function updateRows() {
      const filter = search.value.trim().toLocaleLowerCase('pt-BR');
      tbody.replaceChildren();
      const visible = orders.filter(order => {
        const itemText = order.items.map(describeItem).join(' ');
        return `${order.id} ${order.customer_name} ${order.customer_email} ${itemText}`.toLocaleLowerCase('pt-BR').includes(filter);
      });
      if (!visible.length) {
        const row = document.createElement('tr');
        const cell = element('td', 'Nenhum pedido encontrado.');
        cell.colSpan = 5;
        row.append(cell);
        tbody.append(row);
        return;
      }
      visible.forEach(order => {
        const row = document.createElement('tr');
        const date = new Date(order.created_at).toLocaleString('pt-BR');
        const product = order.items.map(describeItem).join('; ');
        const cells = [
          `${order.id.slice(0,8).toUpperCase()} · ${date}`,
          `${order.customer_name} · ${order.customer_email}`,
          product,
          new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(order.amount_cents / 100),
          paymentStatus(order.status),
        ];
        cells.forEach(value => row.append(element('td', value)));
        tbody.append(row);
      });
    }
    search.addEventListener('input', updateRows);
    updateRows();
  }

  async function loadOrders() {
    if (location.hash !== '#pedidos') return;
    try {
      const data = await request('orders');
      orders = data.orders;
      badge.textContent = String(orders.length);
      renderOrders();
    } catch (reason) {
      if (reason instanceof Error && /Autenticação/.test(reason.message)) {
        await showLogin();
        return;
      }
      showMessage(reason instanceof Error ? reason.message : 'Não foi possível carregar os pedidos.', true);
    }
  }

  async function route() {
    clearInterval(refreshTimer);
    nav.classList.toggle('active', location.hash === '#pedidos');
    if (location.hash !== '#pedidos') return;
    if (document.getElementById('direct-pix-panel')) return;
    try {
      const result = await request('csrf');
      csrf = result.csrf;
    } catch (reason) {
      showMessage(reason instanceof Error ? reason.message : 'Não foi possível iniciar a sessão.', true);
      return;
    }
    await loadOrders();
    refreshTimer = window.setInterval(loadOrders, 15000);
  }

  window.addEventListener('hashchange', route);
  route();
})();
