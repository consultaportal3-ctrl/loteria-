(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const formatMoney = value => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value);
  const pad = value => String(value).padStart(2, '0');
  const numbers = byId('mania-numbers');
  const quantity = byId('mania-quantity');
  const repeats = byId('mania-repeats');
  const selected = new Set();
  const heroTitle = document.querySelector('.hero-copy h1');
  const heroSubtitle = document.querySelector('.hero-copy p');
  const heroTicket = document.querySelector('.campaign-tickets img');
  quantity.value = "50";
  const mirror = byId("mania-mirror");
  numbers.innerHTML = Array.from({length:100}, (_, index) => {
    const number = (index + 1) % 100;
    return `<button type="button" data-mania-number="${number}" aria-label="Número ${pad(number)}" aria-pressed="false">${pad(number)}</button>`;
  }).join('');
  function update(message) {
    const target = Number(quantity.value);
    const total = 3 * Number(repeats.value) * (mirror.checked ? 2 : 1);
    numbers.querySelectorAll('[data-mania-number]').forEach(button => button.setAttribute('aria-pressed', String(selected.has(Number(button.dataset.maniaNumber)))));
    byId('mania-counter').textContent = `${selected.size} de ${target} selecionados`;
    byId('mania-total').textContent = formatMoney(total);
    byId('mania-add').disabled = selected.size !== target;
    document.querySelectorAll('#mania-view [data-step-control]').forEach(button => {
      const control = byId(button.dataset.stepControl);
      const next = control.selectedIndex + Number(button.dataset.step);
      button.disabled = next < 0 || next >= control.options.length;
    });
    byId('mania-message').textContent = message || (selected.size === target ? 'Combinação completa. Você pode adicioná-la ao carrinho.' : `Faltam ${target - selected.size} números para completar sua combinação.`);
    byId('mania-message').classList.toggle('mania-message-visible', Boolean(message));
  }
  function updateCart() {
    const cart = window.portalDemo.getGames();
    byId('mania-cart-count').textContent = cart.length;
    const preview = byId('mania-cart-preview');
    preview.replaceChildren();
    if (!cart.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Seu carrinho está vazio.';
      preview.append(empty);
    }
    let total = 0;
    cart.forEach((item, index) => {
      const price = item.referencePrice;
      total += price;
      if (index < cart.length - 6) return;
      const article = document.createElement('article');
      article.className = 'mega-recent-game';
      article.classList.toggle('recent-super', item.game === 'super');
      article.classList.toggle('recent-dia', item.game === 'dia');
      article.classList.toggle('recent-loteca', item.game === 'loteca');
      article.classList.toggle('recent-dupla', item.game === 'dupla');
      article.classList.toggle('recent-timemania', item.game === 'timemania');
      article.classList.toggle('recent-facil', item.game === 'facil');
      article.classList.toggle('recent-quina', item.game === 'quina');
      article.classList.toggle('recent-mania', item.game === 'mania');
      article.classList.toggle('recent-milionaria', item.game === 'milionaria');
      const header = document.createElement('div');
      header.className = 'mega-recent-header';
      const title = document.createElement('strong');
      title.textContent = item.name.toLowerCase();
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remover jogo ${index + 1}: ${item.name}`);
      remove.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 9v9M14 9v9"/></svg>';
      remove.addEventListener('click', () => window.portalDemo.removeGame(index));
      header.append(title, remove);
      const label = document.createElement('p');
      label.textContent = item.picks ? 'Palpites selecionados' : 'Números selecionados';
      const line = document.createElement('div');
      line.className = 'mega-recent-numbers';
      item.numbers.forEach(number => { const span = document.createElement('span'); span.textContent = pad(number); line.append(span); });
      const details = document.createElement('p');
      if(['mega','facil','quina','mania','timemania','milionaria','dupla','dia','super'].includes(item.game)) {
        const contest = document.createElement('span');
        const contestLabel = document.createElement('strong');
        contestLabel.textContent = 'Concurso: ';
        const first = item.contest || {mega:3084,facil:3825,quina:7163,mania:2997,dupla:3030,super:920,dia:1343,timemania:2466,milionaria:406}[item.game];
        contest.append(contestLabel, `${first}${item.repeats > 1 ? ' a ' + (first - 1 + item.repeats) : ''}`);
        details.append(contest, document.createElement('br'));
      }
      const valueLabel = document.createElement('strong');
      valueLabel.textContent = 'Valor: ';
      details.append(valueLabel, formatMoney(price));
      if (item.picks) {
        window.lotecaRules.labels(item.picks).forEach(text => {const span=document.createElement('span');span.textContent=text;line.append(span);});
      }
      if(item.columns)window.superSeteRules.renderColumns(line,item.columns);
      article.append(header, label, line);
      if(item.trevos) { const trevos=document.createElement('p'); trevos.className='recent-trevos'; trevos.textContent=`Trevos: ${item.trevos.join(' · ')}`; article.append(trevos); }
      if (item.team) {
        const teamDetails = document.createElement('p');
        teamDetails.textContent = `Time do Coração: ${item.team}`;
        article.append(teamDetails);
      }
      if (item.game === 'dia' && Number.isInteger(item.month)) {
        const monthDetails = document.createElement('p');
        monthDetails.className = 'recent-dia-month';
        monthDetails.setAttribute('aria-label', `Mês da Sorte: ${window.portalMonths[item.month]}`);
        monthDetails.textContent = window.portalMonths[item.month].toLocaleUpperCase('pt-BR');
        article.append(monthDetails);
      }
      article.append(details);
      preview.prepend(article);
    });
    byId('mania-cart-total').textContent = formatMoney(total);
  }
  numbers.addEventListener('click', event => {
    const button = event.target.closest('[data-mania-number]');
    if (!button) return;
    const number = Number(button.dataset.maniaNumber);
    if (selected.has(number)) selected.delete(number);
    else if (selected.size < Number(quantity.value)) selected.add(number);
    else { update('Desmarque um número para escolher outro. A Lotomania permite exatamente 50 números.'); return; }
    update();
  });
  repeats.addEventListener('change', () => update());
  mirror.addEventListener('change', () => update());
  document.querySelectorAll('#mania-view [data-step-control]').forEach(button => button.addEventListener('click', () => {
    const control = byId(button.dataset.stepControl);
    const next = control.selectedIndex + Number(button.dataset.step);
    if (next < 0 || next >= control.options.length) return;
    control.selectedIndex = next;
    control.dispatchEvent(new Event('change'));
  }));
  byId('mania-surprise').addEventListener('click', () => {
    selected.clear();
    byId('mania-random').click();
  });
  byId('mania-random').addEventListener('click', () => {
    const pool = Array.from({length:100}, (_, index) => index).filter(number => !selected.has(number));
    for (let index = pool.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index));
      [pool[index],pool[other]] = [pool[other],pool[index]];
    }
    pool.slice(0, Number(quantity.value) - selected.size).forEach(number => selected.add(number));
    update();
    window.portalDemo.recordGeneratedGame({game:'mania',numbers:[...selected],repeats:Number(repeats.value)});
  });
  byId('mania-clear').addEventListener('click', () => { selected.clear(); update(); });
  byId('mania-add').addEventListener('click', () => {
    if (selected.size !== Number(quantity.value)) return;
    const result = window.portalDemo.addManiaGame([...selected], Number(repeats.value), mirror.checked);
    if (!result.ok) { update(result.message); return; }
    selected.clear();
    update('Combinação adicionada ao carrinho de demonstração. Escolha novos números ou confira seus jogos.');
  });
  byId('mania-view-cart').addEventListener('click', () => window.portalDemo.openCart());
  window.addEventListener('portal:cart-change', updateCart);
  function route() {
    const active = location.hash === '#lotomania';
    document.body.classList.toggle('mania-route', active);
    byId('mania-view').hidden = !active;
    document.querySelector('[data-nav-game="mania"]').classList.toggle('active', active);
    if (!active) return;
    document.body.classList.add('mega-route');
    ['modalidades','combos','baixar-aplicativo'].forEach(id => { byId(id).hidden = true; });
    document.querySelectorAll('.campaign-menu .active').forEach(item => item.classList.remove('active'));
    document.querySelector('[data-nav-game="mania"]').classList.add('active');
    heroTitle.textContent = 'Lotomania';
    heroSubtitle.textContent = 'Na Lotomania é fácil apostar e ganhar.';
    heroTicket.setAttribute('src', 'assets/lotomania-ticket.png');
    document.title = 'Loterias Online Caixa';
    window.scrollTo({top:0, behavior:'instant'});
    window.dispatchEvent(new Event('scroll'));
    byId('mania-title').focus({preventScroll:true});
    updateCart();
  }
  window.addEventListener('hashchange', route);
  update();
  updateCart();
  route();
})();
