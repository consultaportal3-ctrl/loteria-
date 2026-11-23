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
    document.querySelectorAll('[data-pool-game]').forEach(button => {
      const selected = button.dataset.poolGame === select.value;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
      const footer = button.querySelector('.modality-count');
      if (footer) {
        const count = pools.filter(pool => pool.game === button.dataset.poolGame).length;
        footer.textContent = `${count} ${count === 1 ? 'bolão' : 'bolões'}`;
      }
    });
    const visible = pools.filter(pool => !select.value || pool.game === select.value);
    featured.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.textContent = loadError ? 'Não foi possível carregar os bolões. Tente novamente.' : 'Ainda não há bolões cadastrados nesta seleção.';
      featured.append(empty);
    }
    for (const pool of visible) {
      const card = document.createElement('article'); card.className = 'pool-card';
      const header = document.createElement('header');
      const title = document.createElement('strong');
      title.textContent = select.querySelector(`option[value="${pool.game}"]`)?.textContent || 'Bolão';
      header.append(title); card.append(header);
      const body = document.createElement('div'); body.className = 'pool-content';
      const date = document.createElement('p'); date.textContent = 'Sorteio: ' + pool.date.split('-').reverse().join('/');
      const heading = document.createElement('h2'); heading.textContent = 'Números do bolão';
      const numbers = document.createElement('div'); numbers.className = 'pool-numbers';
      for (const number of pool.numbers) { const ball = document.createElement('span'); ball.textContent = String(number).padStart(2, '0'); numbers.append(ball); }
      const comparison = document.createElement('p'); comparison.className = 'pool-chance';
      if (['mega','virada'].includes(pool.game) && pool.numbers.length >= 6 && pool.numbers.length <= 20 && pool.numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 60) && new Set(pool.numbers).size === pool.numbers.length) {
        let combinations = 1;
        for (let i = 1; i <= 6; i++) combinations = combinations * (pool.numbers.length - i + 1) / i;
        comparison.textContent = `Esta combinação equivale a ${new Intl.NumberFormat('pt-BR').format(Math.round(combinations))} ${combinations === 1 ? 'aposta simples' : 'apostas simples'} para acertar as 6 dezenas.`;
      }
      const shares = document.createElement('p'); shares.textContent = pool.unlimited ? 'Sem limite de cotas cadastrado' : `${pool.available} cotas disponíveis de ${pool.total}`;
      const price = document.createElement('p'); price.textContent = 'Valor da cota: ' + new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(pool.price / 100);
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
      row.append(minus,quantity,plus); controls.append(row,total); updateQuantity(quantity.value);
      const notice = document.createElement('p'); notice.textContent = 'Compra online de cotas ainda indisponível.';
      const button = document.createElement('button'); button.type = 'button'; button.disabled = true; button.className = 'add-button'; button.textContent = 'Adicionar ao carrinho';
      body.append(date, heading, numbers);
      if (comparison.textContent) body.append(comparison);
      controls.append(button,notice); body.append(shares, price, controls); card.append(body); featured.append(card);
    }
    list.textContent = loadError ? 'Não foi possível carregar os bolões.' : `${visible.length} ${visible.length === 1 ? 'bolão cadastrado' : 'bolões cadastrados'}.`;
    back.href = '../home.html#' + (routes[select.value] || 'modalidades');
    document.title = 'Bolões de ' + name + ' | Portal da Sorte';
  }
  toggle.addEventListener('click', () => {
    filters.hidden = !filters.hidden;
    toggle.setAttribute('aria-expanded', String(!filters.hidden));
    if (!filters.hidden) select.focus();
  });
  select.addEventListener('change', update);
  document.querySelectorAll('[data-pool-game]').forEach(button => {
    if (!button.dataset.poolGame) return;
    const icon = button.querySelector('span');
    if (icon) {
      icon.className = 'modality-clover'; icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 467 460"><path opacity=".48" d="M215 233H87C1 233 1 104 87 104 87 18 215 18 215 104Z"/><path d="M233 233h128c86 0 86-129 0-129 0-86-128-86-128 0Z"/><path d="M215 250H87C1 250 1 379 87 379c0 86 128 86 128 0Z"/><path opacity=".48" d="M233 250h128c86 0 86 129 0 129 0 86-128 86-128 0Z"/></svg>';
    }
    const footer = document.createElement('small'); footer.className = 'modality-count'; footer.textContent = '0 bolões'; button.append(footer);
  });
  document.querySelectorAll('.modality-arrow').forEach(button => button.addEventListener('click', () => {
    document.querySelector('.modality-scroll').scrollBy({left:Number(button.dataset.direction) * 320, behavior:'smooth'});
  }));
  document.querySelectorAll('[data-pool-game]').forEach(button => button.addEventListener('click', () => {
    select.value = button.dataset.poolGame;
    update();
    document.querySelector('.purchase-page').scrollIntoView({behavior:'smooth',block:'start'});
  }));
  fetch('../api/boloes', {cache:'no-store'}).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(result => { pools = Array.isArray(result.pools) ? result.pools : []; }).catch(() => { loadError = true; }).finally(update);
})();
