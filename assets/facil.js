(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const formatMoney = value => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value);
  const pad = value => String(value).padStart(2, '0');
  const numbers = byId('facil-numbers');
  const quantity = byId('facil-quantity');
  const repeats = byId('facil-repeats');
  const selected = new Set();
  const originalTitle = document.title;
  const heroTitle = document.querySelector('.hero-copy h1');
  const heroSubtitle = document.querySelector('.hero-copy p');
  const heroTicket = document.querySelector('.campaign-tickets img');
  const originalHero = {title:heroTitle.textContent,subtitle:heroSubtitle.textContent,ticket:heroTicket.getAttribute('src')};
  quantity.innerHTML = Array.from({length:6}, (_, index) => `<option value="${index + 15}">${index + 15}</option>`).join('');
  numbers.innerHTML = Array.from({length:25}, (_, index) => `<button type="button" data-facil-number="${index + 1}" aria-label="Número ${pad(index + 1)}" aria-pressed="false">${pad(index + 1)}</button>`).join('');
  function combinations(n) {
    let value = 1;
    for (let index = 1; index <= 15; index++) value = value * (n - index + 1) / index;
    return Math.round(value);
  }
  function update(message) {
    const target = Number(quantity.value);
    const total = 3.5 * combinations(target) * Number(repeats.value);
    numbers.querySelectorAll('[data-facil-number]').forEach(button => button.setAttribute('aria-pressed', String(selected.has(Number(button.dataset.facilNumber)))));
    byId('facil-counter').textContent = `${selected.size} de ${target} selecionados`;
    byId('facil-total').textContent = formatMoney(total);
    byId('facil-add').disabled = selected.size !== target;
    document.querySelectorAll('#facil-view [data-step-control]').forEach(button => {
      const control = byId(button.dataset.stepControl);
      const next = control.selectedIndex + Number(button.dataset.step);
      button.disabled = next < 0 || next >= control.options.length;
    });
    byId('facil-message').textContent = message || (selected.size === target ? 'Combinação completa. Você pode adicioná-la ao carrinho.' : `Faltam ${target - selected.size} números para completar sua combinação.`);
  }
  function updateCart() {
    const cart = window.portalDemo.getGames();
    byId('facil-cart-count').textContent = cart.length;
    const preview = byId('facil-cart-preview');
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
      article.classList.toggle('recent-mania', item.game === 'mania');
      article.classList.toggle('recent-facil', item.game === 'facil');
      article.classList.toggle('recent-quina', item.game === 'quina');
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
      if(['mega','facil','quina','milionaria','mania','timemania','dupla','dia','super'].includes(item.game)) {
        const contest = document.createElement('span');
        const contestLabel = document.createElement('strong');
        contestLabel.textContent = 'Concurso: ';
        const first = {mega:3075,facil:3821,quina:7152,milionaria:402,mania:2992,dupla:3025,super:915,dia:1332,timemania:2460}[item.game];
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
    byId('facil-cart-total').textContent = formatMoney(total);
  }
  numbers.addEventListener('click', event => {
    const button = event.target.closest('[data-facil-number]');
    if (!button) return;
    const number = Number(button.dataset.facilNumber);
    if (selected.has(number)) selected.delete(number);
    else if (selected.size < Number(quantity.value)) selected.add(number);
    else { update('Desmarque um número para escolher outro ou aumente a quantidade de números.'); return; }
    update();
  });
  quantity.addEventListener('change', () => {
    const kept = [...selected].sort((a,b) => a-b).slice(0, Number(quantity.value));
    selected.clear();
    kept.forEach(number => selected.add(number));
    update();
  });
  repeats.addEventListener('change', () => update());
  document.querySelectorAll('#facil-view [data-step-control]').forEach(button => button.addEventListener('click', () => {
    const control = byId(button.dataset.stepControl);
    const next = control.selectedIndex + Number(button.dataset.step);
    if (next < 0 || next >= control.options.length) return;
    control.selectedIndex = next;
    control.dispatchEvent(new Event('change'));
  }));
  byId('facil-surprise').addEventListener('click', () => {
    selected.clear();
    byId('facil-random').click();
  });
  byId('facil-random').addEventListener('click', () => {
    const pool = Array.from({length:25}, (_, index) => index + 1).filter(number => !selected.has(number));
    for (let index = pool.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [pool[index],pool[other]] = [pool[other],pool[index]];
    }
    pool.slice(0, Number(quantity.value) - selected.size).forEach(number => selected.add(number));
    update();
    window.portalDemo.recordGeneratedGame({game:'facil',numbers:[...selected],repeats:Number(repeats.value)});
  });
  byId('facil-clear').addEventListener('click', () => { selected.clear(); update(); });
  byId('facil-add').addEventListener('click', () => {
    if (selected.size !== Number(quantity.value)) return;
    const result = window.portalDemo.addFacilGame([...selected], Number(repeats.value));
    if (!result.ok) { update(result.message); return; }
    selected.clear();
    update('Combinação adicionada ao carrinho de demonstração. Escolha novos números ou confira seus jogos.');
  });
  byId('facil-view-cart').addEventListener('click', () => window.portalDemo.openCart());
  window.addEventListener('portal:cart-change', updateCart);
  function route() {
    const active = window.location.hash === '#lotofacil';
    document.body.classList.toggle('facil-route', active);
    byId('facil-view').hidden = !active;
    if (!active) return;
    document.body.classList.add('mega-route');
    byId('facil-view').hidden = !active;
    ['modalidades','combos','baixar-aplicativo'].forEach(id => { byId(id).hidden = active; });
    document.querySelector('.hero-copy').hidden = false;
    document.querySelector('.campaign-art').hidden = false;
    heroTitle.textContent = active ? 'Lotofácil' : originalHero.title;
    heroSubtitle.textContent = active ? 'Ganhar ficou fácil, aposte!' : originalHero.subtitle;
    heroTicket.setAttribute('src','assets/reference-lotofacil.png');
    document.querySelector('[data-nav-game="milionaria"]').classList.remove('active');
    document.querySelector('[data-nav-game="mega"]').classList.remove('active');
    document.querySelector('[data-nav-game="quina"]').classList.remove('active');
    document.querySelector('[data-nav-game="facil"]').classList.add('active');
    document.querySelector('.campaign-menu a[href="#inicio"]').classList.toggle('active', !active);
    document.title = 'Portal da Sorte | Demonstração';
    if (active) {
      window.scrollTo({top:0, behavior:'instant'});
      window.dispatchEvent(new Event('scroll'));
      byId('facil-title').focus({preventScroll:true});
      updateCart();
    } else {
      const target = byId(window.location.hash.slice(1));
      if (target) {
        window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top + window.scrollY - (window.innerWidth <= 720 ? 128 : 170)),behavior:'instant'});
        window.dispatchEvent(new Event('scroll'));
      }
    }
  }
  window.addEventListener('hashchange', route);
  update();
  updateCart();
  route();
})();
