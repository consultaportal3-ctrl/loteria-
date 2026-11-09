(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const formatMoney = value => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value);
  const pad = value => String(value).padStart(2, '0');
  const numbers = byId('mega-numbers');
  const quantity = byId('mega-quantity');
  const repeats = byId('mega-repeats');
  const selected = new Set();
  const originalTitle = document.title;
  const heroTitle = document.querySelector('.hero-copy h1');
  const heroSubtitle = document.querySelector('.hero-copy p');
  const heroTicket = document.querySelector('.campaign-tickets img');
  const originalHero = {title:heroTitle.textContent,subtitle:heroSubtitle.textContent,ticket:heroTicket.getAttribute('src')};
  const contest = byId('mega-view').querySelector('.mega-contest');
  const originalContest = {title:contest.querySelector('h2').textContent,details:contest.querySelector('p').innerHTML};
  const instructions = byId('mega-view').querySelector('.mega-instructions');
  const howToPlay = byId('mega-view').querySelector('.mega-how');
  const originalForm = {instructions:instructions.innerHTML,how:howToPlay.innerHTML};
  quantity.innerHTML = Array.from({length:15}, (_, index) => `<option value="${index + 6}">${index + 6}</option>`).join('');
  numbers.innerHTML = Array.from({length:60}, (_, index) => `<button type="button" data-mega-number="${index + 1}" aria-label="Número ${pad(index + 1)}" aria-pressed="false">${pad(index + 1)}</button>`).join('');
  function combinations(n) {
    let value = 1;
    for (let index = 1; index <= 6; index++) value = value * (n - index + 1) / index;
    return Math.round(value);
  }
  function update(message) {
    const target = Number(quantity.value);
    const total = 6 * combinations(target) * Number(repeats.value);
    numbers.querySelectorAll('[data-mega-number]').forEach(button => button.setAttribute('aria-pressed', String(selected.has(Number(button.dataset.megaNumber)))));
    byId('mega-counter').textContent = `${selected.size} de ${target} selecionados`;
    byId('mega-total').textContent = formatMoney(total);
    byId('mega-add').disabled = selected.size !== target;
    document.querySelectorAll('#mega-view [data-step-control]').forEach(button => {
      const control = byId(button.dataset.stepControl);
      const next = control.selectedIndex + Number(button.dataset.step);
      button.disabled = next < 0 || next >= control.options.length;
    });
    byId('mega-message').textContent = message || (selected.size === target ? 'Combinação completa. Você pode adicioná-la ao carrinho.' : `Faltam ${target - selected.size} números para completar sua combinação.`);
  }
  function updateCart() {
    const cart = window.portalDemo.getGames();
    byId('mega-cart-count').textContent = cart.length;
    const preview = byId('mega-cart-preview');
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
      article.classList.toggle('recent-virada', item.special === 'virada');
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
        const first = item.contest || {mega:3084,facil:3825,quina:7163,milionaria:406,mania:2997,dupla:3030,super:920,dia:1343,timemania:2466}[item.game];
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
    byId('mega-cart-total').textContent = formatMoney(total);
  }
  numbers.addEventListener('click', event => {
    const button = event.target.closest('[data-mega-number]');
    if (!button) return;
    const number = Number(button.dataset.megaNumber);
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
  document.querySelectorAll('#mega-view [data-step-control]').forEach(button => button.addEventListener('click', () => {
    const control = byId(button.dataset.stepControl);
    const next = control.selectedIndex + Number(button.dataset.step);
    if (next < 0 || next >= control.options.length) return;
    control.selectedIndex = next;
    control.dispatchEvent(new Event('change'));
  }));
  byId('mega-surprise').addEventListener('click', () => {
    selected.clear();
    byId('mega-random').click();
  });
  byId('mega-random').addEventListener('click', () => {
    const pool = Array.from({length:60}, (_, index) => index + 1).filter(number => !selected.has(number));
    for (let index = pool.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [pool[index],pool[other]] = [pool[other],pool[index]];
    }
    pool.slice(0, Number(quantity.value) - selected.size).forEach(number => selected.add(number));
    update();
    window.portalDemo.recordGeneratedGame({game:'mega',special:document.body.classList.contains('virada-route')?'virada':undefined,numbers:[...selected],repeats:Number(repeats.value)});
  });
  byId('mega-clear').addEventListener('click', () => { selected.clear(); update(); });
  byId('mega-add').addEventListener('click', () => {
    if (selected.size !== Number(quantity.value)) return;
    const result = window.portalDemo.addMegaGame([...selected], Number(repeats.value), document.body.classList.contains('virada-route'));
    if (!result.ok) { update(result.message); return; }
    selected.clear();
    update('Combinação adicionada ao carrinho de demonstração. Escolha novos números ou confira seus jogos.');
  });
  byId('mega-view-cart').addEventListener('click', () => window.portalDemo.openCart());
  window.addEventListener('portal:cart-change', updateCart);
  function route() {
    const virada = window.location.hash === '#mega-da-virada';
    document.body.classList.toggle('virada-route', virada);
    instructions.innerHTML = virada ? 'A Mega da Virada é o concurso especial da Mega-Sena que acontece anualmente na virada do ano. Considerado o maior concurso das Loterias CAIXA, a Mega da Virada oferta prêmios bilionários e não acumula. Se ninguém acertar a faixa principal, de 6 números, o prêmio é dividido entre os acertadores da segunda faixa, com acerto de 5 números e assim por diante. Neste ano, o prêmio é estimado em R$ 1 bilhão! Não fique de fora, aposte!' : originalForm.instructions;
    howToPlay.innerHTML = virada ? '<h2 id="mega-how-title">Como jogar</h2><p>As regras para jogar na Mega da Virada são as mesmas dos concursos regulares da Mega Sena. Para ganhar o prêmio principal é preciso acertar os 6 números dentre os 60 disponíveis. Também é possível ganhar prêmios acertando 5 ou 4 números. A diferença é que a Mega da Virada não acumula. Se ninguém acertar a Sena, o prêmio é destinado aos acertadores da Quina e assim por diante. Está disponível a opção de Surpresinha, quando o sistema escolhe os números aleatoriamente.</p>' : originalForm.how;
    numbers.setAttribute('aria-label', `Volante da ${virada ? 'Mega da Virada' : 'Mega-Sena'}, números de 01 a 60`);
    document.querySelectorAll('.campaign-menu a[href="#mega-da-virada"]').forEach(link => link.classList.toggle('active', virada));
    if (['#lotofacil','#quina','#mais-milionaria'].includes(window.location.hash)) { byId('mega-view').hidden = true; return; }
    const wasActive = document.body.classList.contains('mega-route');
    const active = window.location.hash === '#mega-sena' || virada;
    document.body.classList.toggle('mega-route', active);
    byId('mega-view').hidden = !active;
    ['modalidades','combos','baixar-aplicativo'].forEach(id => { byId(id).hidden = active; });
    document.querySelector('.hero-copy').hidden = false;
    document.querySelector('.campaign-art').hidden = false;
    heroTitle.textContent = active ? 'Mega-Sena' : originalHero.title;
    heroSubtitle.textContent = active ? 'A loteria que paga milhões para quem acerta os seis números sorteados.' : originalHero.subtitle;
    heroTicket.setAttribute('src',active ? 'assets/reference-mega-sena.png' : originalHero.ticket);
    document.querySelector('[data-nav-game="milionaria"]').classList.remove('active');
    document.querySelector('[data-nav-game="mega"]').classList.toggle('active', active && !virada);
    document.querySelector('[data-nav-game="facil"]').classList.remove('active');
    document.querySelector('[data-nav-game="quina"]').classList.remove('active');
    document.querySelector('.campaign-menu a[href="#inicio"]').classList.toggle('active', !active);
    document.title = 'Loterias Online Caixa';
    contest.querySelector('h2').textContent = virada ? 'Concurso nº 3100' : originalContest.title;
    contest.querySelector('p').innerHTML = virada ? '<strong>Encerramento das Apostas:</strong> 31/12/2026 22h00<br><strong>Data do Sorteio:</strong> 01/01/2027 11h00<br><strong>Estimativa de prêmio:</strong> R$ 1.000.000.000,00' : originalContest.details;
    if (virada) {
      repeats.value = '1';
      update();
      heroTitle.textContent = 'Mega da Virada';
      heroSubtitle.textContent = 'Chegou a hora de apostar no maior prêmio das Loterias CAIXA. No portal você aposta online na Mega da Virada e concorre ao prêmio estimado de R$ 1 bilhão. É muito dinheiro para qualquer um!';
      heroTicket.setAttribute('src', 'assets/mega-virada-ticket.png');
      document.title = 'Loterias Online Caixa';
    }
    if (active) {
      window.scrollTo({top:0, behavior:'instant'});
      window.dispatchEvent(new Event('scroll'));
      byId('mega-title').focus({preventScroll:true});
      updateCart();
    } else if (wasActive) {
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
