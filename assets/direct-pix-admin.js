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
  async function request(action, data, params = {}) {
    const url = new URL(api);
    if (!data) url.searchParams.set('action', action);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
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
  const gameNames = {mega:'Mega-Sena',facil:'Lotofácil',quina:'Quina',milionaria:'+Milionária',mania:'Lotomania',timemania:'Timemania',dupla:'Dupla Sena',dia:'Dia de Sorte',loteca:'Loteca',super:'Super Sete'};
  function pageLabel(page) {
    const [path, hash] = String(page || '').split('#');
    const sections = {inicio:'Início',modalidades:'Todos os produtos',combos:'Combos','baixar-aplicativo':'Baixar aplicativo',checkout:'Dados para gerar PIX',carrinho:'Carrinho','mega-sena':'Mega-Sena','mega-da-virada':'Mega da Virada',lotofacil:'Lotofácil',quina:'Quina','mais-milionaria':'+Milionária',lotomania:'Lotomania',timemania:'Timemania','dupla-sena':'Dupla Sena',loteca:'Loteca','dia-de-sorte':'Dia de Sorte','super-sete':'Super Sete'};
    return sections[hash] || ({'/':'Entrada do site','/index.html':'Entrada do site','/home.html':'Página inicial','/carrinho.html':'Carrinho','/compra-bolao/index.html':'Compra de bolão','/demonstracao.html':'Demonstração'})[path] || page;
  }
  function selectionText(item) {
    const details = [item.special === 'virada' ? 'Mega da Virada' : gameNames[item.game] || item.game];
    if (item.contest) details.push('Concurso ' + item.contest);
    if (Array.isArray(item.numbers) && item.numbers.length) details.push('Números: ' + item.numbers.map(n => String(n).padStart(2,'0')).join(', '));
    if (Array.isArray(item.trevos)) details.push('Trevos: ' + item.trevos.join(', '));
    if (Array.isArray(item.columns)) details.push(item.columns.map((column,i) => `Coluna ${i+1}: ${column.join('/')}`).join(' · '));
    if (Array.isArray(item.picks)) details.push(item.picks.map((mask,i) => `Jogo ${i+1}: ${[1,2,4].flatMap((bit,j) => mask & bit ? [['1','X','2'][j]] : []).join('/')}`).join(' · '));
    if (item.team) details.push('Time: ' + item.team);
    if (Number.isInteger(item.month)) details.push('Mês da sorte: ' + (item.month + 1));
    if (item.repeats > 1) details.push(item.repeats + ' concursos');
    return details.join(' · ');
  }
  function visitorList(host, current) {
    const expanded = new Set();
    const card = node('section', undefined, 'card');
    const heading = node('div', undefined, 'card-heading');
    const text = node('div');
    const count = node('h2', 'Carregando visitantes online…');
    text.append(count, node('p', 'Acompanhe onde o visitante está, o caminho que percorreu e as apostas e PIX que gerou. Atualização a cada 1 segundo. Cidade aproximada.'));
    const refresh = node('button', 'Atualizar agora', 'button secondary');
    refresh.type = 'button';
    const clear = node('button', 'Limpar histórico de visitas', 'button secondary');
    clear.type = 'button';
    heading.append(text, refresh, clear);
    const message = node('p', '', 'settings-body');
    message.setAttribute('role', 'status');
    const scroll = node('div', undefined, 'table-scroll');
    const pagination = node('div', undefined, 'card-heading');
    const previous = node('button', 'Anterior', 'button secondary');
    const next = node('button', 'Próxima', 'button secondary');
    previous.type = next.type = 'button';
    pagination.append(previous, next);
    card.append(heading, message, scroll, pagination);
    host.append(card);
    let loading = false, clearing = false, offset = 0, rendered = '';
    async function update() {
      if (loading || clearing || document.hidden || current !== generation || !host.isConnected) return;
      loading = true; refresh.disabled = true;
      try {
        const result = await request('visitors', undefined, {offset});
        if (clearing || current !== generation || !host.isConnected) return;
        count.textContent = `${result.count} visitante${result.count === 1 ? '' : 's'} online`;
        message.textContent = `${result.total} visitas salvas. Exibindo ${result.visitors.length ? offset + 1 : 0}–${offset + result.visitors.length}. Atualizado às ${new Date(result.updatedAt).toLocaleTimeString('pt-BR')}. Online = atividade nos últimos 90 segundos.`;
        previous.disabled = offset === 0;
        next.disabled = offset + result.limit >= result.total;
        const signature = JSON.stringify({offset, visitors:result.visitors});
        if (signature === rendered) return;
        rendered = signature;
        scroll.replaceChildren();
        if (!result.visitors.length) { scroll.append(node('p', 'Nenhuma visita salva nesta página.', 'settings-body')); return; }
        const table = node('table');
        table.className = 'visitor-activity-table';
        table.innerHTML = '<thead><tr><th>VISITANTE</th><th>STATUS</th><th>CIDADE APROXIMADA</th><th>ESTADO / PAÍS</th><th>ONDE ESTÁ / ÚLTIMO ACESSO</th><th>O QUE GEROU</th><th>HISTÓRICO DO VISITANTE</th><th>ÚLTIMA ATIVIDADE</th></tr></thead>';
        const body = node('tbody');
        for (const visitor of result.visitors) {
          const row = node('tr');
          row.append(node('td', 'Visitante ' + visitor.id.slice(0, 8)));
          const status = node('td');
          status.append(node('span', visitor.online ? 'Online' : 'Offline', visitor.online ? 'visitor-status is-online' : 'visitor-status'));
          row.append(status);
          for (const value of [visitor.city || 'Não identificada', [visitor.region, visitor.country].filter(Boolean).join(' / ') || 'Não identificado']) row.append(node('td', value));
          const currentPage = node('td');
          currentPage.append(node('strong', pageLabel(visitor.page)), node('small', visitor.page));
          row.append(currentPage);
          const generated = node('td');
          generated.append(node('span', `${visitor.generatedCount || 0} aposta(s) gerada(s)`, visitor.generatedCount ? 'visitor-generation has-generated' : 'visitor-generation'),
            node('span', `${visitor.pixCount || 0} PIX gerado(s)`, visitor.pixCount ? 'visitor-generation has-pix' : 'visitor-generation'));
          row.append(generated);
          const historyCell = node('td'), details = node('details', undefined, 'visitor-history');
          details.open = expanded.has(visitor.id);
          const events = Array.isArray(visitor.events) ? visitor.events : [];
          details.append(node('summary', `Ver caminho e gerações (${events.length})`));
          details.addEventListener('toggle', () => { if (!details.isConnected) return; if (details.open) expanded.add(visitor.id); else expanded.delete(visitor.id); });
          const timeline = node('ol', undefined, 'visitor-timeline');
          for (const event of [...events].reverse()) {
            const entry = node('li', undefined, 'visitor-event ' + (event.type === 'page' ? '' : 'visitor-event-generated'));
            entry.append(node('small', new Date(event.at).toLocaleString('pt-BR')));
            if (event.type === 'generated_game') {
              entry.append(node('strong', 'Gerou uma aposta'), node('p', selectionText(event.item || {})));
            } else if (event.type === 'pix_generated') {
              entry.append(node('strong', event.simulation ? 'Gerou um PIX de simulação' : 'Gerou um PIX'),
                node('p', `${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(event.amount / 100)} · Pedido ${event.orderId}`),
                node('p', 'PIX gerado; a confirmação do pagamento fica em Pedidos.'));
              for (const item of event.items || []) entry.append(node('p', selectionText(item)));
            } else entry.append(node('strong', 'Acessou ' + pageLabel(event.page)));
            entry.append(node('small', event.page || ''));
            timeline.append(entry);
          }
          if (!events.length) timeline.append(node('li', 'Os próximos acessos e gerações aparecerão aqui.'));
          details.append(timeline); historyCell.append(details); row.append(historyCell, node('td', new Date(visitor.lastSeen).toLocaleString('pt-BR')));
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
    previous.addEventListener('click', () => { if (!loading && !clearing) { offset = Math.max(0, offset - 100); update(); } });
    next.addEventListener('click', () => { if (!loading && !clearing) { offset += 100; update(); } });
    clear.addEventListener('click', async () => {
      if (clearing || loading || !window.confirm('Limpar todas as visitas salvas? Essa ação não pode ser desfeita. Quem continuar no site aparecerá novamente na próxima atualização de presença.')) return;
      clearing = true; clear.disabled = true;
      try {
        await request('clear-visitors', {confirm:true});
        offset = 0; rendered = ''; expanded.clear();
        scroll.replaceChildren();
      } catch (error) { message.textContent = error.message; return; }
      finally { clearing = false; clear.disabled = false; }
      await update();
    });
    update();
    refreshTimer = setInterval(update, 1000);
  }
  function storeSummary(host, current) {
    const fullHistory = host.dataset.view === 'generations';
    const heading = node('div', undefined, 'section-heading'), title = node('div');
    title.append(node('h2', fullHistory ? 'Tudo o que foi gerado na loja' : 'Resumo do seu site'),
      node('p', 'Apostas e PIX de todos os visitantes, salvos no servidor. Atualização automática a cada 5 segundos.'));
    const refresh = node('button', 'Atualizar painel', 'button secondary'); refresh.type = 'button';
    heading.append(title, refresh); host.append(heading);
    const metrics = node('div', undefined, 'metrics');
    const money = amount => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amount / 100);
    const values = [];
    for (const [label, detail] of [['Valor dos PIX gerados','PIX reais gerados; pagamento deve ser conferido em Pedidos.'],['Combinações geradas','Apostas geradas pelos visitantes de toda a loja.'],['PIX gerados','Pedidos com PIX criado, incluindo simulações identificadas.'],['Modalidades no site','Catálogo disponível na loja.']]) {
      const metric = node('article', undefined, 'metric');
      const value = node('strong', '…'); values.push(value);
      metric.append(node('div', label, 'metric-top'), value, node('p', detail)); metrics.append(metric);
    }
    host.append(metrics);
    const card = node('section', undefined, 'card'), cardHeading = node('div', undefined, 'card-heading');
    const description = node('div'); description.append(node('h2', fullHistory ? 'Histórico de apostas e PIX gerados' : 'Gerações recentes de toda a loja'));
    const link = node('a', fullHistory ? 'Voltar ao resumo' : 'Ver histórico completo →', 'button secondary');
    link.href = fullHistory ? '#visao' : '#vendas'; cardHeading.append(description, link);
    const message = node('p', 'Carregando registros…', 'settings-body'); message.setAttribute('role','status');
    const scroll = node('div', undefined, 'table-scroll');
    const pagination = node('div', undefined, 'card-heading');
    const previous = node('button', 'Anterior', 'button secondary'), next = node('button', 'Próxima', 'button secondary');
    previous.type = next.type = 'button'; pagination.append(previous, next); pagination.hidden = !fullHistory;
    card.append(cardHeading, message, scroll, pagination); host.append(card);
    let loading = false, offset = 0, rendered = '';
    async function update() {
      if (loading || document.hidden || current !== generation || !host.isConnected) return;
      loading = true; refresh.disabled = true;
      try {
        const result = await request('generations', undefined, {offset});
        if (current !== generation || !host.isConnected) return;
        values[0].textContent = money(result.pixAmount); values[1].textContent = result.generatedCount;
        values[2].textContent = result.pixCount; values[3].textContent = Object.keys(window.homeProductReference.draws).length;
        const badge = document.getElementById('sales-badge'); if (badge) badge.textContent = result.generatedCount;
        const rows = fullHistory ? result.events : result.events.slice(0, 6);
        message.textContent = `${result.total} registros de toda a loja. ${rows.length ? `Exibindo ${offset+1}–${offset+rows.length}. ` : ''}Atualizado às ${new Date(result.updatedAt).toLocaleTimeString('pt-BR')}.${result.importing ? ' Importando o histórico já existente…' : ''}`;
        previous.disabled = offset === 0; next.disabled = offset + result.limit >= result.total;
        const signature = JSON.stringify({offset, rows}); if (signature === rendered) return; rendered = signature;
        scroll.replaceChildren();
        if (!rows.length) { scroll.append(node('p', 'As próximas apostas e os PIX gerados na loja aparecerão aqui automaticamente.', 'settings-body')); return; }
        const table = node('table');
        table.innerHTML = '<thead><tr><th>HORÁRIO</th><th>VISITANTE</th><th>O QUE GEROU</th><th>MODALIDADES / NÚMEROS / SELEÇÕES</th><th>VALOR / PEDIDO</th></tr></thead>';
        const body = node('tbody');
        for (const event of rows) {
          const row = node('tr'); row.append(node('td', new Date(event.at).toLocaleString('pt-BR')));
          const visitor = node('td'); visitor.append(node('strong', event.visitorId === 'anonymous' ? 'Visitante sem identificação' : 'Visitante ' + (event.visitorId || '').slice(0,8)), node('small', event.city || 'Cidade não identificada')); row.append(visitor);
          const isPix = event.type === 'pix_generated';
          row.append(node('td', isPix ? event.simulation ? 'PIX de simulação' : 'PIX gerado' : 'Aposta gerada'));
          const selections = node('td');
          for (const item of isPix ? event.items || [] : [event.item || {}]) selections.append(node('p', selectionText(item), 'bet-selection'));
          row.append(selections);
          const value = node('td'); value.append(node('strong', isPix ? money(event.amount) : '—'));
          if (isPix) value.append(node('small', 'Pedido ' + event.orderId), node('small', 'Gerado; consulte o pagamento em Pedidos.'));
          row.append(value); body.append(row);
        }
        table.append(body); scroll.append(table);
      } catch (error) {
        if (current !== generation || !host.isConnected) return;
        message.textContent = error.message;
        if (error.status === 401) { clearInterval(refreshTimer); login(host, current); }
      } finally { loading = false; refresh.disabled = false; }
    }
    refresh.addEventListener('click', update);
    previous.addEventListener('click', () => { if (!loading) { offset = Math.max(0,offset-50); update(); } });
    next.addEventListener('click', () => { if (!loading) { offset += 50; update(); } });
    update(); refreshTimer = setInterval(update, 5000);
  }
  function securityView(host, current) {
    const heading = node('div', undefined, 'section-heading'), title = node('div');
    title.append(node('h2', 'Segurança e IPs'), node('p', 'Veja acessos repetidos e bloqueie IPs. O bloqueio vale para todos que usam o mesmo IP.'));
    const refresh = node('button', 'Atualizar', 'button secondary'); refresh.type = 'button'; heading.append(title, refresh); host.append(heading);
    const status = node('p', 'Carregando…', 'muted'); status.setAttribute('role','status'); host.append(status);
    const forms = node('div', undefined, 'settings-grid'), manualCard = node('section', undefined, 'card'), autoCard = node('section', undefined, 'card');
    manualCard.innerHTML = '<div class="card-heading"><h2>Bloquear um IP</h2></div><form id="block-ip-form" class="settings-body"><label>IP a bloquear<input name="ip" placeholder="Ex.: 203.0.113.10" maxlength="45" required autocomplete="off"></label><label>Duração<select name="duration"><option value="15">15 minutos</option><option value="60">1 hora</option><option value="1440" selected>24 horas</option><option value="10080">7 dias</option><option value="0">Até desbloquear</option></select></label><label>Motivo (opcional)<input name="reason" maxlength="160" placeholder="Ex.: acessos repetidos"></label><button class="button" type="submit">Bloquear IP</button><p role="status" hidden></p></form>';
    autoCard.innerHTML = '<div class="card-heading"><h2>Limite automático de acessos</h2></div><form id="ip-limit-form" class="settings-body"><label><input type="checkbox" name="automatic"> Ativar bloqueio automático</label><label>Acessos a páginas por IP, em cada minuto<input type="number" name="maxRequests" min="10" max="1000" value="60" required></label><label>Tempo do bloqueio<select name="duration"><option value="5">5 minutos</option><option value="15" selected>15 minutos</option><option value="60">1 hora</option><option value="1440">24 horas</option></select></label><p class="muted">Arquivos de imagens, estilos e atualizações do painel não entram nessa contagem. O painel continua acessível para desbloquear IPs.</p><button class="button" type="submit">Salvar limite</button><p role="status" hidden></p></form>';
    forms.append(manualCard,autoCard); host.append(forms);
    const blockedCard = node('section', undefined, 'card'), trafficCard = node('section', undefined, 'card');
    blockedCard.append(node('div', 'IPs bloqueados', 'card-heading')); trafficCard.append(node('div', 'Acessos recentes por IP · últimos 100', 'card-heading'));
    const blockedRows = node('div', undefined, 'table-scroll'), trafficRows = node('div', undefined, 'table-scroll');
    blockedCard.append(blockedRows); trafficCard.append(trafficRows); host.append(blockedCard,trafficCard);
    const manual = manualCard.querySelector('form'), automatic = autoCard.querySelector('form');
    let loading = false, saving = false, initialized = false, lastData = '';
    function button(text, action) { const value = node('button',text,'button secondary'); value.type='button'; value.addEventListener('click',action); return value; }
    async function mutate(action, data, form) {
      if (saving) return;
      saving=true;
      const controls = host.querySelectorAll('button'); controls.forEach(control=>{control.disabled=true;});
      const message = form?.querySelector('[role=status]') || status;
      message.hidden=false; message.textContent='Salvando…';
      try { await request(action,data); message.textContent=action==='unblock-ip'?'IP desbloqueado.':action==='block-ip'?'IP bloqueado.':'Limite salvo.'; lastData=''; }
      catch(error) { message.textContent=error.message; }
      finally {saving=false;controls.forEach(control=>{control.disabled=false;});await update();}
    }
    manual.addEventListener('submit',event=>{event.preventDefault();mutate('block-ip',{ip:manual.elements.ip.value.trim(),durationMinutes:Number(manual.elements.duration.value),reason:manual.elements.reason.value},manual);});
    automatic.addEventListener('submit',event=>{event.preventDefault();mutate('save-security',{settings:{automatic:automatic.elements.automatic.checked,maxRequests:Number(automatic.elements.maxRequests.value),durationMinutes:Number(automatic.elements.duration.value)}},automatic);});
    async function update() {
      if (loading || saving || document.hidden || current!==generation || !host.isConnected) return;
      loading=true;
      try {
        const result=await request('security'); if(current!==generation || !host.isConnected)return;
        status.textContent=`Seu IP: ${result.currentIp||'não identificado'}. Atualizado às ${new Date(result.updatedAt).toLocaleTimeString('pt-BR')}.`;
        if(!initialized){automatic.elements.automatic.checked=result.settings.automatic;automatic.elements.maxRequests.value=result.settings.maxRequests;automatic.elements.duration.value=result.settings.durationMinutes;initialized=true;}
        const signature=JSON.stringify([result.blocks,result.traffic,result.currentIp]);if(signature===lastData)return;lastData=signature;
        blockedRows.replaceChildren();trafficRows.replaceChildren();
        const blockTable=node('table');blockTable.innerHTML='<thead><tr><th>IP</th><th>ORIGEM / MOTIVO</th><th>BLOQUEADO ATÉ</th><th>AÇÃO</th></tr></thead>';const blocks=node('tbody');
        for(const record of result.blocks){const row=node('tr');row.append(node('td',record.ip),node('td',(record.automatic?'Automático':'Manual')+(record.reason?' · '+record.reason:'')),node('td',record.expiresAt?new Date(record.expiresAt).toLocaleString('pt-BR'):'Até desbloquear'));const action=node('td');action.append(button('Desbloquear',()=>mutate('unblock-ip',{ip:record.ip})));row.append(action);blocks.append(row);}
        blockTable.append(blocks);blockedRows.append(result.blocks.length?blockTable:node('p','Nenhum IP bloqueado.','settings-body'));
        const trafficTable=node('table');trafficTable.innerHTML='<thead><tr><th>IP</th><th>ACESSOS NESTE MINUTO</th><th>TOTAL DE PÁGINAS</th><th>TENTATIVAS BLOQUEADAS</th><th>ÚLTIMO CAMINHO</th><th>ÚLTIMO ACESSO</th><th>AÇÃO</th></tr></thead>';const traffic=node('tbody');
        for(const record of result.traffic){const row=node('tr');for(const value of [record.ip,record.minuteCount,record.total,record.denied,record.page,new Date(record.lastSeen).toLocaleString('pt-BR')])row.append(node('td',value));const action=node('td');const isBlocked=result.blocks.some(block=>block.ip===record.ip),self=record.ip===result.currentIp;const control=button(self?'Seu IP':isBlocked?'Desbloquear':'Bloquear por 24 horas',()=>isBlocked?mutate('unblock-ip',{ip:record.ip}):mutate('block-ip',{ip:record.ip,durationMinutes:1440,reason:'Acessos repetidos'}));control.disabled=self;action.append(control);row.append(action);traffic.append(row);}
        trafficTable.append(traffic);trafficRows.append(result.traffic.length?trafficTable:node('p','Os próximos acessos às páginas da loja aparecerão aqui.','settings-body'));
      } catch(error){status.textContent=error.message;if(error.status===401){clearInterval(refreshTimer);login(host,current);}}
      finally{loading=false;}
    }
    refresh.addEventListener('click',update);update();refreshTimer=setInterval(update,5000);
  }
  async function authenticated(host, current) {
    const visitorsView = host.dataset.view === 'visitors';
    const summaryView = ['overview','generations'].includes(host.dataset.view);
    const security = host.dataset.view === 'security';
    const [settings, orders] = visitorsView || summaryView || security ? [] : await Promise.all([request('settings'), request('orders')]);
    if (current !== generation || !host.isConnected) return;
    clearInterval(refreshTimer); host.replaceChildren();
    const toolbar = node('div', undefined, 'section-heading'), title = node('h2', visitorsView ? 'Visitantes online' : summaryView ? 'Administração da loja' : 'Administração do PIX direto');
    const logout = node('button', 'Sair do acesso administrativo', 'button secondary'); logout.type = 'button';
    logout.addEventListener('click', async () => {
      try { await request('logout', {}); await mount(); }
      catch (error) { host.prepend(node('p', error.message, 'admin-error')); }
    });
    toolbar.append(title, logout); host.append(toolbar);
    if (visitorsView) { visitorList(host, current); return; }
    if (summaryView) { storeSummary(host, current); return; }
    if (security) { securityView(host, current); return; }
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
