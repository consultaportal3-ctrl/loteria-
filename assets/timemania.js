(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const formatMoney = value => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value);
  const pad = value => String(value).padStart(2, '0');
  const numbers = byId('timemania-numbers');
  const quantity = byId('timemania-quantity');
  const repeats = byId('timemania-repeats');
  const selected = new Set();
  const heroTitle = document.querySelector('.hero-copy h1');
  const heroSubtitle = document.querySelector('.hero-copy p');
  const heroTicket = document.querySelector('.campaign-tickets img');
  quantity.value = "10";
  const team = byId("timemania-team");
  window.timemaniaTeams.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    team.append(option);
  });
  const teamList = byId('timemania-team-list');
  const teamPrev = byId('timemania-team-prev');
  const teamNext = byId('timemania-team-next');
  window.timemaniaTeams.forEach(name => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'timemania-team-card';
    button.dataset.team = name;
    button.setAttribute('aria-label', name);
    button.setAttribute('aria-pressed', 'false');
    const badge = document.createElement('img');
    badge.src = window.timemaniaBadges[name];
    badge.alt = '';
    badge.width = 48;
    badge.height = 48;
    badge.draggable = false;
    const label = document.createElement('span');
    label.textContent = name.toLocaleUpperCase('pt-BR');
    button.append(badge, label);
    button.addEventListener('click', () => {
      team.value = name;
      team.dispatchEvent(new Event('change'));
    });
    teamList.append(button);
  });
  function syncTeamScroll() {
    const maximum = Math.max(0, teamList.scrollWidth - teamList.clientWidth);
    teamPrev.disabled = teamList.scrollLeft <= 1;
    teamNext.disabled = teamList.scrollLeft >= maximum - 1;
    const fraction = maximum ? teamList.scrollLeft / maximum : 0;
    const width = Math.min(100, teamList.clientWidth / Math.max(1, teamList.scrollWidth) * 100);
    const thumb = byId('timemania-team-progress-thumb');
    thumb.style.width = `${width}%`;
    thumb.style.left = `${fraction * (100 - width)}%`;
  }
  const moveTeams = direction => {
    teamList.scrollBy({left:direction * teamList.clientWidth,behavior:'instant'});
    syncTeamScroll();
  };
  teamPrev.addEventListener('click', () => moveTeams(-1));
  teamNext.addEventListener('click', () => moveTeams(1));
  teamList.addEventListener('scroll', syncTeamScroll, {passive:true});
  new ResizeObserver(syncTeamScroll).observe(teamList);
  const selectedBadge = byId('timemania-selected-badge');
  const normalizeTeam = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  byId('timemania-team-search').addEventListener('input', event => {
    const query = normalizeTeam(event.target.value.trim());
    let count = 0;
    teamList.querySelectorAll('[data-team]').forEach(button => {
      button.hidden = !normalizeTeam(button.dataset.team).includes(query);
      if (!button.hidden) count++;
    });
    teamList.scrollTo({left:0,behavior:'instant'});
    syncTeamScroll();
    byId('timemania-team-status').textContent = `${count} time(s) encontrado(s).`;
  });
  numbers.innerHTML = Array.from({length:80}, (_, index) => {
    const number = index + 1;
    return `<button type="button" data-timemania-number="${number}" aria-label="Número ${pad(number)}" aria-pressed="false">${pad(number)}</button>`;
  }).join('');
  function update(message) {
    const target = Number(quantity.value);
    const total = 3.5 * Number(repeats.value);
    numbers.querySelectorAll('[data-timemania-number]').forEach(button => button.setAttribute('aria-pressed', String(selected.has(Number(button.dataset.timemaniaNumber)))));
    byId('timemania-counter').textContent = `${selected.size} de ${target} selecionados`;
    byId('timemania-total').textContent = formatMoney(total);
    byId('timemania-add').disabled = selected.size !== target || !team.value;
    teamList.querySelectorAll('[data-team]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.team === team.value)));
    byId('timemania-team-status').textContent = team.value ? `Time do Coração: ${team.value}` : 'Nenhum time selecionado';
    selectedBadge.hidden = !team.value;
    if (team.value) {
      selectedBadge.src = window.timemaniaBadges[team.value];
      selectedBadge.alt = `Time selecionado: ${team.value}`;
    }
    document.querySelectorAll('#timemania-view [data-step-control]').forEach(button => {
      const control = byId(button.dataset.stepControl);
      const next = control.selectedIndex + Number(button.dataset.step);
      button.disabled = next < 0 || next >= control.options.length;
    });
    byId('timemania-message').textContent = message || (selected.size === target ? (team.value ? 'Combinação completa. Você pode adicioná-la ao carrinho.' : 'Escolha seu Time do Coração para completar a combinação.') : `Faltam ${target - selected.size} números para completar sua combinação.`);
    byId('timemania-message').classList.toggle('timemania-message-visible', Boolean(message));
  }
  function updateCart() {
    const cart = window.portalDemo.getGames();
    byId('timemania-cart-count').textContent = cart.length;
    const preview = byId('timemania-cart-preview');
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
      article.classList.toggle('recent-mania', item.game === 'mania');
      article.classList.toggle('recent-facil', item.game === 'facil');
      article.classList.toggle('recent-quina', item.game === 'quina');
      article.classList.toggle('recent-timemania', item.game === 'timemania');
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
    byId('timemania-cart-total').textContent = formatMoney(total);
  }
  numbers.addEventListener('click', event => {
    const button = event.target.closest('[data-timemania-number]');
    if (!button) return;
    const number = Number(button.dataset.timemaniaNumber);
    if (selected.has(number)) selected.delete(number);
    else if (selected.size < Number(quantity.value)) selected.add(number);
    else { update('Desmarque um número para escolher outro. A Timemania permite exatamente 10 números.'); return; }
    update();
  });
  repeats.addEventListener('change', () => update());
  team.addEventListener('change', () => update());
  byId('timemania-team-random').addEventListener('click', () => {
    team.value = window.timemaniaTeams[Math.floor(Math.random() * window.timemaniaTeams.length)];
    update();
  });
  document.querySelectorAll('#timemania-view [data-step-control]').forEach(button => button.addEventListener('click', () => {
    const control = byId(button.dataset.stepControl);
    const next = control.selectedIndex + Number(button.dataset.step);
    if (next < 0 || next >= control.options.length) return;
    control.selectedIndex = next;
    control.dispatchEvent(new Event('change'));
  }));
  byId('timemania-surprise').addEventListener('click', () => {
    selected.clear();
    if (!team.value) byId('timemania-team-random').click();
    byId('timemania-random').click();
  });
  byId('timemania-random').addEventListener('click', () => {
    const pool = Array.from({length:80}, (_, index) => index + 1).filter(number => !selected.has(number));
    for (let index = pool.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [pool[index],pool[other]] = [pool[other],pool[index]];
    }
    pool.slice(0, Number(quantity.value) - selected.size).forEach(number => selected.add(number));
    update();
    window.portalDemo.recordGeneratedGame({game:'timemania',numbers:[...selected],team:team.value,repeats:Number(repeats.value)});
  });
  byId('timemania-clear').addEventListener('click', () => { selected.clear(); team.value = ''; update(); });
  byId('timemania-add').addEventListener('click', () => {
    if (selected.size !== Number(quantity.value) || !team.value) return;
    const result = window.portalDemo.addTimemaniaGame([...selected], Number(repeats.value), team.value);
    if (!result.ok) { update(result.message); return; }
    selected.clear();
    team.value = '';
    update('Combinação adicionada ao carrinho de demonstração. Escolha novos números ou confira seus jogos.');
  });
  byId('timemania-view-cart').addEventListener('click', () => window.portalDemo.openCart());
  window.addEventListener('portal:cart-change', updateCart);
  function route() {
    const active = location.hash === '#timemania';
    document.body.classList.toggle('timemania-route', active);
    byId('timemania-view').hidden = !active;
    document.querySelector('[data-nav-game="timemania"]').classList.toggle('active', active);
    if (!active) return;
    document.body.classList.add('mega-route');
    ['modalidades','combos','baixar-aplicativo'].forEach(id => { byId(id).hidden = true; });
    document.querySelectorAll('.campaign-menu .active').forEach(item => item.classList.remove('active'));
    document.querySelector('[data-nav-game="timemania"]').classList.add('active');
    heroTitle.textContent = 'Timemania';
    heroSubtitle.textContent = 'Com a Timemania, seu palpite no futebol pode render uma bolada.';
    heroTicket.setAttribute('src', 'assets/timemania-ticket.png');
    document.title = 'Loterias Online Caixa';
    window.scrollTo({top:0, behavior:'instant'});
    window.dispatchEvent(new Event('scroll'));
    byId('timemania-title').focus({preventScroll:true});
    requestAnimationFrame(syncTeamScroll);
    updateCart();
  }
  window.addEventListener('hashchange', route);
  update();
  updateCart();
  route();
})();
