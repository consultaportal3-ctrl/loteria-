(() => {
  'use strict';
  const select = document.getElementById('purchase-game');
  const choice = document.getElementById('purchase-choice');
  const back = document.getElementById('purchase-back');
  const toggle = document.getElementById('filter-toggle');
  const filters = document.getElementById('filters');
  const featured = document.querySelector('.featured');
  const list = document.querySelector('.all-pools p');
  let pools = [];
  let loadError = false;
  const routes = {virada:'mega-virada', mega:'mega-sena', facil:'lotofacil', quina:'quina', milionaria:'mais-milionaria', dupla:'dupla-sena', timemania:'timemania', dia:'dia-de-sorte', super:'super-sete'};
  const requested = new URLSearchParams(location.search).get('modalidade');
  select.value = Object.hasOwn(routes, requested) ? requested : '';
  function update() {
    const name = select.value ? select.selectedOptions[0].textContent : 'Todos os bolões';
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
      const shares = document.createElement('p'); shares.textContent = `${pool.available} cotas disponíveis de ${pool.total}`;
      const price = document.createElement('p'); price.textContent = 'Valor da cota: ' + new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(pool.price / 100);
      const notice = document.createElement('p'); notice.textContent = 'Compra online de cotas ainda indisponível.';
      const button = document.createElement('button'); button.type = 'button'; button.disabled = true; button.className = 'add-button'; button.textContent = 'Compra indisponível';
      body.append(date, heading, numbers);
      if (comparison.textContent) body.append(comparison);
      body.append(shares, price, notice, button); card.append(body); featured.append(card);
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
  fetch('../api/boloes', {cache:'no-store'}).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(result => { pools = Array.isArray(result.pools) ? result.pools : []; }).catch(() => { loadError = true; }).finally(update);
})();
