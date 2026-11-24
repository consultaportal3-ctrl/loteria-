(() => {
  'use strict';
  const select = document.getElementById('purchase-game');
  const choice = document.getElementById('purchase-choice');
  const back = document.getElementById('purchase-back');
  const toggle = document.getElementById('filter-toggle');
  const filters = document.getElementById('filters');
  const tutorial = document.getElementById('pool-tutorial');
  const hideTutorial = document.getElementById('tutorial-hide');
  function closeTutorial() {
    if (hideTutorial.checked) { try { localStorage.setItem('pool-tutorial-hidden', '1'); } catch (_) {} }
    tutorial.close();
  }
  tutorial.querySelector('.tutorial-start').addEventListener('click', closeTutorial);
  tutorial.querySelector('.tutorial-skip').addEventListener('click', closeTutorial);
  try { if (localStorage.getItem('pool-tutorial-hidden') !== '1') tutorial.showModal(); } catch (_) { tutorial.showModal(); }
  const featured = document.querySelector('.featured');
  const list = document.querySelector('.all-pools p');
  let pools = [];
  let poolsLoading = true;
  let prizes = {};
  let loadError = false;
  try {
    const cart = JSON.parse(localStorage.getItem('portal-demo-games-v1') || '[]');
    document.getElementById('pool-cart-count').textContent = Array.isArray(cart) ? String(cart.length) : '0';
  } catch { document.getElementById('pool-cart-count').textContent = '0'; }
  const routes = {virada:'mega-virada', mega:'mega-sena', facil:'lotofacil', quina:'quina', loteca:'loteca', milionaria:'mais-milionaria', dupla:'dupla-sena', timemania:'timemania', dia:'dia-de-sorte', super:'super-sete'};
  const requested = new URLSearchParams(location.search).get('modalidade');
  select.value = Object.hasOwn(routes, requested) ? requested : '';
  function update() {
    const name = select.value ? select.selectedOptions[0].textContent : 'Todos os bolões';
    document.querySelector('.pool-hero .hero-copy h1').textContent = ['dupla','dia','super'].includes(select.value) ? 'Aposte nos Bolões CAIXA' : select.value ? `Bolões de ${name}` : 'Conheça os Bolões CAIXA';
    const virada = select.value === 'virada';
    const mega = ['mega','facil','milionaria','timemania','dupla','dia','super'].includes(select.value);
    const friday = select.value === 'quina';
    const loteca = select.value === 'loteca';
    document.querySelector('.pool-hero').dataset.game = select.value;
    document.querySelector('.pool-hero').classList.toggle('show-virada', virada);
    document.querySelector('.pool-hero').classList.toggle('show-mega', mega);
    document.querySelector('.pool-hero').style.setProperty('--selected-game-color', ({mega:'#00a94f',facil:'#92278f',milionaria:'#2b327d',timemania:'#fff200',dupla:'#af2942',dia:'#e5c71c',super:'#bedb28'})[select.value] || '#00a94f');
    document.querySelector('.pool-hero').style.setProperty('--selected-game-text', ({timemania:'#007a43',dia:'#806800',super:'#007a43'})[select.value] || '#fff');
    document.querySelector('.pool-hero').classList.toggle('show-friday', friday);
    document.querySelector('.pool-hero').classList.toggle('show-loteca', loteca);
    document.querySelector('.virada-highlight').hidden = !virada;
    document.querySelector('.virada-details').hidden = !virada;
    document.querySelector('.mega-highlight').hidden = !mega;
    document.querySelector('.mega-details').hidden = !mega;
    document.querySelector('.friday-highlight').hidden = !friday;
    document.querySelector('.friday-details').hidden = !friday;
    document.querySelector('.loteca-highlight').hidden = !loteca;
    document.querySelector('.loteca-details').hidden = !loteca;
    const viradaPrices = pools.filter(pool => pool.game === 'virada' && (pool.unlimited || pool.available > 0) && Number.isInteger(pool.price) && pool.price > 0).map(pool => pool.price);
    document.getElementById('virada-price').textContent = viradaPrices.length ? 'Valor cadastrado a partir de ' + new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.min(...viradaPrices)/100) : 'Consulte os bolões cadastrados';
    const megaPrices = pools.filter(pool => pool.game === select.value && (pool.unlimited || pool.available > 0) && Number.isInteger(pool.price) && pool.price > 0).map(pool => pool.price);
    document.getElementById('mega-pool-price').textContent = megaPrices.length ? 'Cotas a partir de ' + new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.min(...megaPrices)/100) : 'Consulte os bolões cadastrados';
    document.getElementById('mega-name').textContent = ({mega:'Mega-Sena',facil:'Lotofácil',milionaria:'+Milionária',timemania:'Timemania',dupla:'Dupla Sena',dia:'Dia de Sorte',super:'Super Sete'})[select.value] || 'Mega-Sena';
    const megaPrize = prizes[select.value];
    document.getElementById('mega-prize').textContent = megaPrize ? (megaPrize.amount >= 1000000 ? `R$ ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(megaPrize.amount / 1000000)} ${megaPrize.amount === 1000000 ? 'Milhão' : 'Milhões'}` : megaPrize.amount >= 1000 ? `R$ ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(megaPrize.amount / 1000)} Mil` : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(megaPrize.amount)) : 'Prêmio indisponível';
    document.getElementById('mega-contest').textContent = megaPrize ? `Prêmio estimado do concurso ${megaPrize.contest}` : 'Estimativa indisponível no momento';
    if (select.value === 'super' && !megaPrize) {
      document.getElementById('mega-prize').textContent = 'R$ 650 Mil';
      document.getElementById('mega-contest').textContent = 'Valor de referência — consulte a estimativa atual';
    }
    document.getElementById('mega-date').textContent = megaPrize?.date ? megaPrize.date.split('-').reverse().join('/') + (select.value === 'mega' && megaPrize.contest === 3090 ? ' às 21h00' : ' — consulte o horário oficial') : 'Data indisponível';
    const drawLabel = document.getElementById('mega-draw-label');
    drawLabel.textContent = 'Sorteio';
    if (['dupla','dia','super'].includes(select.value) && megaPrize?.date) {
      const day = new Intl.DateTimeFormat('pt-BR', {weekday:'long', timeZone:'UTC'}).format(new Date(`${megaPrize.date}T12:00:00Z`));
      drawLabel.textContent = `Sorteio ${day.charAt(0).toUpperCase() + day.slice(1)}`;
    }
    const fridayPrices = pools.filter(pool => pool.game === 'quina' && (pool.unlimited || pool.available > 0) && Number.isInteger(pool.price) && pool.price > 0).map(pool => pool.price);
    document.getElementById('friday-price').textContent = fridayPrices.length ? 'Valor cadastrado a partir de ' + new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.min(...fridayPrices)/100) : 'Consulte os bolões cadastrados';
    const lotecaPrices = pools.filter(pool => pool.game === 'loteca' && (pool.unlimited || pool.available > 0) && Number.isInteger(pool.price) && pool.price > 0).map(pool => pool.price);
    document.getElementById('loteca-price').textContent = lotecaPrices.length ? 'Valor cadastrado a partir de ' + new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.min(...lotecaPrices)/100) : 'Consulte os bolões cadastrados';
    const remaining = Math.ceil((Date.parse('2026-12-31T22:00:00-03:00') - Date.now()) / 86400000);
    document.getElementById('virada-countdown').textContent = remaining > 0 ? `Apostas oficiais encerram em aproximadamente ${remaining} ${remaining === 1 ? 'dia' : 'dias'}` : 'Prazo oficial de apostas encerrado';
    document.querySelectorAll('[data-pool-game]').forEach(button => {
      const selected = button.dataset.poolGame === select.value;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
      const footer = button.querySelector('.modality-count');
      if (footer) {
        const prize = prizes[button.dataset.poolGame];
        if (prize?.amount) {
          const amount = prize.amount;
          footer.textContent = amount >= 1000000000 ? `R$ ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(amount/1000000000)} Bilhão` : amount >= 1000000 ? `R$ ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(amount/1000000)} ${amount === 1000000 ? 'Milhão' : 'Milhões'}` : button.dataset.poolGame === 'super' && amount >= 1000 ? `R$ ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(amount/1000)} Mil` : `R$ ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(amount)}`;
          footer.title = `Prêmio estimado do concurso ${prize.contest}; sujeito a alterações.`;
        } else if (button.dataset.poolGame === 'super') { footer.textContent = 'R$ 650 Mil'; footer.title = 'Valor de referência informado; consulte a estimativa atual.'; }
        else { footer.textContent = 'Consulte o prêmio'; footer.title = 'Estimativa indisponível no momento.'; }
      }
    });
    const examples = [
      {id:'virada-1', game:'virada', date:'', numbers:[], total:9, available:3, price:5048, description:'2 apostas de 8 dezenas'},
      {id:'virada-2', game:'virada', date:'', numbers:[], total:9, available:6, price:5048, description:'8 apostas de 7 dezenas'},
      {id:'virada-3', game:'virada', date:'', numbers:[], total:26, available:3, price:1125, description:'5 apostas de 7 dezenas'},
      {id:'virada-4', game:'virada', date:'', numbers:[], total:100, available:28, price:313956, description:'1 aposta de 20 dezenas'}
    ];
    const visible = [...examples, ...pools].filter(pool => !select.value || pool.game === select.value);
    featured.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.textContent = poolsLoading ? 'Carregando bolões...' : loadError ? 'Não foi possível carregar os bolões. Tente novamente.' : 'Ainda não há bolões cadastrados nesta seleção.';
      featured.append(empty);
    }
    for (const pool of visible) {
      const card = document.createElement('article'); card.className = 'pool-card';
      const header = document.createElement('header');
      const title = document.createElement('strong');
      title.textContent = select.querySelector(`option[value="${pool.game}"]`)?.textContent || 'Bolão';
      const icon = document.createElement('span'); icon.className = 'pool-card-icon'; icon.setAttribute('aria-hidden', 'true'); icon.innerHTML = '<svg viewBox="0 0 467 460" aria-hidden="true"><path d="M215 233H87C1 233 1 104 87 104 87 18 215 18 215 104Z"/><path opacity=".55" d="M233 233h128c86 0 86-129 0-129 0-86-128-86-128 0Z"/><path opacity=".55" d="M215 250H87C1 250 1 379 87 379c0 86 128 86 128 0Z"/><path d="M233 250h128c86 0 86 129 0 129 0 86-128 86-128 0Z"/></svg>';
      header.append(icon, title); card.append(header);
      const body = document.createElement('div'); body.className = 'pool-content';
      const prize = prizes[pool.game];
      const prizeValue = document.createElement('p'); prizeValue.className = 'pool-prize'; prizeValue.textContent = prize?.amount ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(prize.amount) : 'Prêmio em consulta';
      const prizeCaption = document.createElement('p'); prizeCaption.className = 'pool-prize-caption'; prizeCaption.textContent = prize?.contest ? 'Prêmio estimado do concurso ' + prize.contest : 'Estimativa indisponível no momento';
      const date = document.createElement('p'); date.textContent = pool.date ? 'Sorteio: ' + pool.date.split('-').reverse().join('/') : 'Data do sorteio a confirmar.';
      const heading = document.createElement('h2'); heading.textContent = 'Números do bolão';
      const numbers = document.createElement('div'); numbers.className = 'pool-numbers';
      for (const number of pool.numbers) { const ball = document.createElement('span'); ball.textContent = String(number).padStart(2, '0'); numbers.append(ball); }
      const comparison = document.createElement('p'); comparison.className = 'pool-chance';
      if (['mega','virada'].includes(pool.game) && pool.numbers.length >= 6 && pool.numbers.length <= 20 && pool.numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 60) && new Set(pool.numbers).size === pool.numbers.length) {
        let combinations = 1;
        for (let i = 1; i <= 6; i++) combinations = combinations * (pool.numbers.length - i + 1) / i;
        comparison.textContent = `Esta combinação equivale a ${new Intl.NumberFormat('pt-BR').format(Math.round(combinations))} ${combinations === 1 ? 'aposta simples' : 'apostas simples'} para acertar as 6 dezenas.`;
      }
      const shares = document.createElement('p'); shares.className = 'pool-shares'; shares.textContent = pool.unlimited ? 'Sem limite de cotas cadastrado' : `${pool.available} cotas disponíveis de ${pool.total}`;
      const price = document.createElement('p'); price.className = 'pool-price'; price.textContent = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(pool.price / 100);
      const controls = document.createElement('div'); controls.className = 'pool-purchase';
      const row = document.createElement('div'); row.className = 'pool-quantity';
      const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label','Diminuir quantidade de cotas');
      const maxQuantity = pool.unlimited ? 10000 : pool.available;
      const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '1'; quantity.max = String(maxQuantity); quantity.value = maxQuantity > 0 ? '1' : '0'; quantity.setAttribute('aria-label','Quantidade de cotas'); quantity.disabled = maxQuantity < 1;
      const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label','Aumentar quantidade de cotas');
      const total = document.createElement('p'); total.className = 'pool-total';
      function updateQuantity(value) {
        const n = maxQuantity > 0 ? Math.min(maxQuantity, Math.max(1, Math.floor(Number(value) || 1))) : 0;
        quantity.value = n; minus.disabled = n <= 1; plus.disabled = n >= maxQuantity;
        total.textContent = 'Total: ' + new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(pool.price * n / 100);
      }
      minus.addEventListener('click', () => updateQuantity(Number(quantity.value)-1));
      plus.addEventListener('click', () => updateQuantity(Number(quantity.value)+1));
      quantity.addEventListener('change', () => updateQuantity(quantity.value));
      const quantityLabel = document.createElement('p'); quantityLabel.className = 'pool-quantity-label'; quantityLabel.textContent = 'Quantidade de cotas';
      row.append(minus,quantity,plus); controls.append(quantityLabel,row,total); updateQuantity(quantity.value);
      const notice = document.createElement('p'); notice.textContent = 'Compra online de cotas ainda indisponível.';
      const button = document.createElement('button'); button.type = 'button'; button.disabled = true; button.className = 'add-button'; button.textContent = 'Colocar no carrinho';
      const description = document.createElement('p'); description.className = 'pool-description'; description.textContent = pool.description || '';
      const details = document.createElement('details'); details.className = 'pool-card-details';
      const summary = document.createElement('summary'); summary.textContent = 'Detalhes';
      details.append(summary, date);
      if (pool.numbers.length) details.append(heading, numbers);
      else { const pending = document.createElement('p'); pending.textContent = 'Números das apostas ainda não informados.'; details.append(pending); }
      if (comparison.textContent) details.append(comparison);
      body.append(prizeValue, prizeCaption);
      if (description.textContent) body.append(description);
      body.append(details);
      controls.append(button,notice); body.append(shares, price, controls); card.append(body); featured.append(card);
    }
    list.textContent = poolsLoading ? 'Carregando bolões...' : loadError ? 'Não foi possível carregar os bolões.' : `${visible.length} ${visible.length === 1 ? 'bolão cadastrado' : 'bolões cadastrados'}.`;
    back.href = '../home.html#' + (routes[select.value] || 'modalidades');
    document.title = 'Bolões de ' + name + ' | Portal da Sorte';
  }
  toggle.addEventListener('click', () => {
    filters.hidden = !filters.hidden;
    toggle.setAttribute('aria-expanded', String(!filters.hidden));
    if (!filters.hidden) select.focus();
  });
  function chooseGame(value) {
    select.value = Object.hasOwn(routes, value) ? value : '';
    const url = new URL(location.href);
    if (select.value) url.searchParams.set('modalidade', select.value);
    else url.searchParams.delete('modalidade');
    history.replaceState(history.state, '', url);
    update();
  }
  select.addEventListener('change', () => chooseGame(select.value));
  document.querySelectorAll('[data-pool-game]').forEach(button => {
    if (!button.dataset.poolGame) return;
    const icon = button.querySelector('span');
    if (icon) {
      icon.className = 'modality-clover'; icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 467 460"><path opacity=".48" d="M215 233H87C1 233 1 104 87 104 87 18 215 18 215 104Z"/><path d="M233 233h128c86 0 86-129 0-129 0-86-128-86-128 0Z"/><path d="M215 250H87C1 250 1 379 87 379c0 86 128 86 128 0Z"/><path opacity=".48" d="M233 250h128c86 0 86 129 0 129 0 86-128 86-128 0Z"/></svg>';
    }
    const footer = document.createElement('small'); footer.className = 'modality-count'; footer.textContent = 'Consultando...'; button.append(footer);
  });
  document.querySelectorAll('.modality-arrow').forEach(button => button.addEventListener('click', () => {
    document.querySelector('.modality-scroll').scrollBy({left:Number(button.dataset.direction) * 320, behavior:'smooth'});
  }));
  document.querySelectorAll('[data-pool-game]').forEach(button => button.addEventListener('click', () => {
    chooseGame(button.dataset.poolGame);
    document.querySelector('.purchase-page').scrollIntoView({behavior:'smooth',block:'start'});
  }));
  update();
  fetch('../api/boloes', {cache:'no-store', signal:AbortSignal.timeout(10000)}).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(result => { pools = Array.isArray(result.pools) ? result.pools : []; }).catch(() => { loadError = true; }).finally(() => { poolsLoading = false; update(); });
  fetch('../api/premios', {cache:'no-store', signal:AbortSignal.timeout(10000)}).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(result => { prizes = result.prizes || {}; }).catch(() => {}).finally(update);
})();
