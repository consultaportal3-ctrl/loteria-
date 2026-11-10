(() => {
  'use strict';
  let csrf = '', generation = 0, refreshTimer;
  const api = new URL('api/pix-settings', location.href);
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  async function request(action, data) {
    const url = new URL(api);
    if (!data) url.searchParams.set('action', action);
    const response = await fetch(url, {method:data ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store',
      headers:data ? {'Content-Type':'application/json'} : {}, body:data ? JSON.stringify({...data, action, csrf}) : undefined});
    let result;
    try { result = await response.json(); } catch { throw new Error('A API do painel não respondeu corretamente. Confira a publicação do servidor.'); }
    if (!response.ok) { const error = new Error(result.error || 'Não foi possível concluir a operação.'); error.status = response.status; throw error; }
    return result;
  }
  function login(host, current) {
    host.innerHTML = '<section class="card"><div class="settings-body"><h2>Acesso administrativo</h2><p>Entre com a senha do painel para acessar esta seção.</p><form id="direct-pix-login"><label>Senha do painel<input name="password" type="password" autocomplete="current-password" required></label><button class="button" type="submit">Entrar</button><p role="alert" class="admin-error" hidden></p></form></div></section>';
    const form = host.querySelector('form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button'), message = form.querySelector('[role="alert"]');
      button.disabled = true; message.hidden = true;
      try {
        const result = await request('login', {password:form.elements.password.value});
        csrf = result.csrf;
        if (current === generation && host.isConnected) await authenticated(host, current);
      } catch (error) { message.textContent = error.message; message.hidden = false; }
      finally { button.disabled = false; }
    });
  }
  function configuration(host, settings) {
    const card = node('section', undefined, 'card');
    card.innerHTML = '<div class="card-heading"><div><h2>Sua chave PIX</h2><p>A chave precisa estar cadastrada no seu banco. O nome real do titular será exibido pelo aplicativo bancário ao cliente.</p></div></div><form id="direct-pix-form" class="settings-body"><label>Tipo da chave<select name="keyType"><option value="random">Chave aleatória</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option></select></label><label>Chave PIX<input name="key" type="password" autocomplete="off" maxlength="77" required></label><label><input name="showKey" type="checkbox"> Mostrar a chave neste painel</label><label>Nome do titular (até 25 caracteres)<input name="receiverName" maxlength="25" required></label><label>Cidade do titular (até 15 caracteres)<input name="city" maxlength="15" required></label><label><input name="enabled" type="checkbox"> Ativar PIX direto na loja</label><label><input name="ownershipConfirmed" type="checkbox" required> Confirmo que esta chave pertence ao titular informado e está cadastrada no banco.</label><p>Novos pedidos usarão esta configuração. Códigos já gerados continuam apontando para a chave anterior e não podem ser revogados por este painel.</p><p>Sem gateway, não há confirmação automática. Confira o crédito no extrato antes de confirmar um pedido.</p><button class="button" type="submit">Salvar configuração PIX</button><p role="status" hidden></p></form>';
    const form = card.querySelector('form');
    if (settings) {
      for (const field of ['keyType','key','receiverName','city']) form.elements[field].value = settings[field] || '';
      form.elements.enabled.checked = settings.enabled === true;
    }
    form.elements.showKey.addEventListener('change', () => { form.elements.key.type = form.elements.showKey.checked ? 'text' : 'password'; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button'), message = form.querySelector('[role="status"]');
      button.disabled = true; message.hidden = true;
      try {
        await request('save', {settings:{keyType:form.elements.keyType.value, key:form.elements.key.value,
          receiverName:form.elements.receiverName.value, city:form.elements.city.value,
          enabled:form.elements.enabled.checked, ownershipConfirmed:form.elements.ownershipConfirmed.checked}});
        message.textContent = 'Configuração salva no servidor. Os novos pedidos usarão a opção selecionada.';
        message.className = 'muted';
      } catch (error) { message.textContent = error.message; message.className = 'admin-error'; }
      finally { message.hidden = false; button.disabled = false; }
    });
    host.append(card);
  }
  function orderList(host, orders, current) {
    const section = node('section', undefined, 'card');
    const heading = node('div', undefined, 'card-heading');
    const text = node('div');
    text.append(node('h2', 'Pedidos com PIX direto'), node('p', 'Últimos 200 pedidos. Gerar o PIX não confirma o pagamento nem o registro da aposta.'));
    const refresh = node('button', 'Atualizar', 'button secondary');
    refresh.type = 'button'; refresh.addEventListener('click', () => refreshOrders());
    heading.append(text, refresh); section.append(heading);
    const list = node('div', undefined, 'settings-body');
    async function refreshOrders() {
      refresh.disabled = true;
      try {
        const result = await request('orders');
        if (generation === current && host.isConnected) render(result.orders);
      } catch (error) {
        if (generation === current && host.isConnected) list.replaceChildren(node('p', error.message, 'admin-error'));
      } finally { refresh.disabled = false; }
    }
    function render(rows) {
      list.replaceChildren();
      if (!rows.length) { list.append(node('p', 'Nenhum pedido de PIX direto encontrado.')); return; }
      for (const order of rows) {
        const article = node('article', undefined, 'card');
        const body = node('div', undefined, 'settings-body');
        body.append(node('h3', `Pedido ${order.id}`), node('p', `${order.customer_name} · ${order.customer_email}`),
          node('p', `${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(order.amount / 100)} · ${new Date(order.createdAt).toLocaleString('pt-BR')}`),
          node('p', order.status === 'manual_confirmed' ? 'Recebimento confirmado manualmente pelo operador. Registro da aposta pendente.' : 'Aguardando conferência do crédito no extrato.'));
        for (const item of order.items || []) {
          const details = [item.name || item.game];
          if (Array.isArray(item.numbers)) details.push(item.numbers.join(', '));
          if (Array.isArray(item.trevos)) details.push('Trevos: ' + item.trevos.join(', '));
          if (Array.isArray(item.columns)) details.push(item.columns.map((column, index) => `C${index + 1}: ${column.join('/')}`).join('; '));
          if (Array.isArray(item.picks)) details.push('Palpites: ' + item.picks.join(', '));
          if (item.team) details.push('Time: ' + item.team);
          if (Number.isInteger(item.month)) details.push('Mês: ' + (item.month + 1));
          if (item.repeats > 1) details.push(item.repeats + ' concursos');
          body.append(node('p', details.join(' · ')));
        }
        if (order.bankReference) body.append(node('p', `Referência bancária: ${order.bankReference}`));
        if (order.status === 'awaiting_manual_confirmation') {
          const form = document.createElement('form');
          form.innerHTML = '<label>Referência da transação no extrato<input name="bankReference" minlength="4" maxlength="100" required></label><label><input type="checkbox" name="bankChecked" required> Conferi no extrato o titular, o crédito e o valor exato deste pedido.</label><button class="button secondary" type="submit">Confirmar recebimento manualmente</button><p role="alert" hidden></p>';
          form.addEventListener('submit', async event => {
            event.preventDefault(); const button = form.querySelector('button'), message = form.querySelector('[role="alert"]');
            button.disabled = true;
            try {
              await request('confirm', {orderId:order.id, bankReference:form.elements.bankReference.value, bankChecked:form.elements.bankChecked.checked});
              await refreshOrders();
            } catch (error) { message.textContent = error.message; message.hidden = false; button.disabled = false; }
          });
          body.append(form);
        }
        article.append(body); list.append(article);
      }
      const badge = document.getElementById('orders-badge'); if (badge) badge.textContent = String(rows.length);
    }
    render(orders); section.append(list); host.append(section);
    refreshTimer = setInterval(refreshOrders, 30000);
  }
  function visitorList(host, current) {
    const card = node('section', undefined, 'card');
    const heading = node('div', undefined, 'card-heading');
    const text = node('div');
    const count = node('h2', 'Carregando visitantes online…');
    text.append(count, node('p', 'Atualização a cada 1 segundo. Online = atividade nos últimos 90 segundos. Cidade aproximada pela conexão de internet.'));
    const refresh = node('button', 'Atualizar agora', 'button secondary');
    refresh.type = 'button';
    heading.append(text, refresh);
    const message = node('p', '', 'settings-body');
    message.setAttribute('role', 'status');
    const scroll = node('div', undefined, 'table-scroll');
    card.append(heading, message, scroll);
    host.append(card);
    let loading = false;
    async function update() {
      if (loading || document.hidden || current !== generation || !host.isConnected) return;
      loading = true; refresh.disabled = true;
      try {
        const result = await request('visitors');
        if (current !== generation || !host.isConnected) return;
        count.textContent = `${result.count} visitante${result.count === 1 ? '' : 's'} online`;
        message.textContent = `Atualizado às ${new Date(result.updatedAt).toLocaleTimeString('pt-BR')}. Identificadores anônimos por navegador; até 500 acessos na lista.`;
        scroll.replaceChildren();
        if (!result.visitors.length) { scroll.append(node('p', 'Nenhum visitante online neste momento.', 'settings-body')); return; }
        const table = node('table');
        table.innerHTML = '<thead><tr><th>VISITANTE</th><th>CIDADE APROXIMADA</th><th>ESTADO / PAÍS</th><th>PÁGINA</th><th>ÚLTIMA ATIVIDADE</th></tr></thead>';
        const body = node('tbody');
        for (const visitor of result.visitors) {
          const row = node('tr');
          for (const value of ['Visitante ' + visitor.id.slice(0, 8), visitor.city || 'Não identificada', [visitor.region, visitor.country].filter(Boolean).join(' / ') || 'Não identificado', visitor.page, new Date(visitor.lastSeen).toLocaleTimeString('pt-BR')]) row.append(node('td', value));
          body.append(row);
        }
        table.append(body); scroll.append(table);
      } catch (error) {
        if (current === generation && host.isConnected) {
          count.textContent = 'Não foi possível atualizar os visitantes';
          message.textContent = error.message;
          scroll.replaceChildren();
          if (error.status === 401) { clearInterval(refreshTimer); login(host, current); }
        }
      } finally { loading = false; refresh.disabled = false; }
    }
    refresh.addEventListener('click', update);
    update();
    refreshTimer = setInterval(update, 1000);
  }
  async function authenticated(host, current) {
    const visitorsView = host.dataset.view === 'visitors';
    const [settings, orders] = visitorsView ? [] : await Promise.all([request('settings'), request('orders')]);
    if (current !== generation || !host.isConnected) return;
    clearInterval(refreshTimer); host.replaceChildren();
    const toolbar = node('div', undefined, 'section-heading'), title = node('h2', visitorsView ? 'Visitantes online' : 'Administração do PIX direto');
    const logout = node('button', 'Sair do acesso administrativo', 'button secondary'); logout.type = 'button';
    logout.addEventListener('click', async () => {
      try { await request('logout', {}); await mount(); }
      catch (error) { host.prepend(node('p', error.message, 'admin-error')); }
    });
    toolbar.append(title, logout); host.append(toolbar);
    if (visitorsView) { visitorList(host, current); return; }
    if (host.dataset.view === 'settings') configuration(host, settings.settings);
    orderList(host, orders.orders, current);
  }
  async function mount() {
    const current = ++generation; clearInterval(refreshTimer);
    const host = document.getElementById('direct-pix-panel');
    if (!host) return;
    try {
      const session = await request('session');
      if (current !== generation || !host.isConnected) return;
      csrf = session.csrf;
      if (!session.authConfigured) {
        host.replaceChildren(node('h2', 'Defina a senha administrativa'), node('p', 'Na Vercel, adicione ADMIN_PASSWORD como Secret no ambiente Production, usando uma senha nova com pelo menos 16 caracteres, e faça um redeploy. Depois volte a esta página. Não compartilhe a senha no chat.'));
      } else if (!session.authenticated) login(host, current);
      else await authenticated(host, current);
    } catch (error) { if (current === generation && host.isConnected) host.replaceChildren(node('p', error.message, 'admin-error')); }
  }
  window.addEventListener('pix-panel-render', mount);
  mount();
})();
