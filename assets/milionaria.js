(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const formatMoney = value => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value);
  const pad = value => String(value).padStart(2, '0');
  const numbers = byId('milionaria-numbers');
  const quantity = byId('milionaria-quantity');
  const repeats = byId('milionaria-repeats');
  const selected = new Set();
  const selectedTrevos = new Set();
  const trevoQuantity=byId('milionaria-trevo-quantity');
  const trevos=byId('milionaria-trevos');
  trevos.innerHTML=Array.from({length:6},(_,i)=>`<button type="button" data-trevo="${i+1}" aria-label="Trevo ${i+1}" aria-pressed="false"><svg viewBox="0 0 54 54" aria-hidden="true" focusable="false"><path d="M27 9C22-2 10 0 11 12C0 9-3 23 9 27C-3 31 0 45 11 42C10 54 22 56 27 45C32 56 44 54 43 42C54 45 57 31 45 27C57 23 54 9 43 12C44 0 32-2 27 9Z"/></svg><b aria-hidden="true">${i+1}</b></button>`).join('');
  const originalTitle = document.title;
  const heroTitle = document.querySelector('.hero-copy h1');
  const heroSubtitle = document.querySelector('.hero-copy p');
  const heroTicket = document.querySelector('.campaign-tickets img');
  const originalHero = {title:heroTitle.textContent,subtitle:heroSubtitle.textContent,ticket:heroTicket.getAttribute('src')};
  quantity.innerHTML = Array.from({length:7}, (_, index) => `<option value="${index + 6}">${index + 6}</option>`).join('');
  numbers.innerHTML = Array.from({length:50}, (_, index) => `<button type="button" data-milionaria-number="${index + 1}" aria-label="Número ${pad(index + 1)}" aria-pressed="false">${pad(index + 1)}</button>`).join('');
  function combinations(n) {
    let value = 1;
    for (let index = 1; index <= 6; index++) value = value * (n - index + 1) / index;
    return Math.round(value);
  }
  function update(message) {
    const target = Number(quantity.value);
    const total = 6 * combinations(target) * (Number(trevoQuantity.value)*(Number(trevoQuantity.value)-1)/2) * Number(repeats.value);
    numbers.querySelectorAll('[data-milionaria-number]').forEach(button => button.setAttribute('aria-pressed', String(selected.has(Number(button.dataset.milionariaNumber)))));
    byId('milionaria-counter').textContent = `${selected.size} de ${target} selecionados`;
    byId('milionaria-total').textContent = formatMoney(total);
    byId('milionaria-add').disabled = selected.size !== target || selectedTrevos.size !== Number(trevoQuantity.value);
    trevos.querySelectorAll('[data-trevo]').forEach(button=>button.setAttribute('aria-pressed',String(selectedTrevos.has(Number(button.dataset.trevo)))));
    document.querySelectorAll('#milionaria-view [data-step-control]').forEach(button => {
      const control = byId(button.dataset.stepControl);
      const next = control.selectedIndex + Number(button.dataset.step);
      button.disabled = next < 0 || next >= control.options.length;
    });
    byId('milionaria-message').textContent = message || (selected.size===target && selectedTrevos.size!==Number(trevoQuantity.value) ? `Selecione ${Number(trevoQuantity.value)-selectedTrevos.size} trevo(s) para completar.` : null) || (selected.size === target ? 'Combinação completa. Você pode adicioná-la ao carrinho.' : `Faltam ${target - selected.size} números para completar sua combinação.`);
  }
  function updateCart() {
    const cart = window.portalDemo.getGames();
    byId('milionaria-cart-count').textContent = cart.length;
    const preview = byId('milionaria-cart-preview');
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
        const first = item.contest || {mega:3086,facil:3829,quina:7167,milionaria:407,mania:2999,dupla:3032,super:922,dia:1347,timemania:2468}[item.game];
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
      if(item.trevos) {
        const label = document.createElement('p');
        label.textContent = 'Trevos';
        const line = document.createElement('div');
        line.className = 'recent-trevos';
        item.trevos.forEach(number => {
          const clover = document.createElement('span');
          clover.className = 'recent-trevo';
          clover.setAttribute('aria-label', `Trevo ${number}`);
          clover.innerHTML = trevos.querySelector(`[data-trevo="${number}"]`).innerHTML;
          line.append(clover);
        });
        article.append(label, line);
      }
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
    byId('milionaria-cart-total').textContent = formatMoney(total);
  }
  numbers.addEventListener('click', event => {
    const button = event.target.closest('[data-milionaria-number]');
    if (!button) return;
    const number = Number(button.dataset.milionariaNumber);
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
  trevos.addEventListener('click',event=>{
    const button=event.target.closest('[data-trevo]');if(!button)return;
    const n=Number(button.dataset.trevo);
    if(selectedTrevos.has(n))selectedTrevos.delete(n);
    else if(selectedTrevos.size<Number(trevoQuantity.value))selectedTrevos.add(n);
    else {update('Aumente a quantidade de trevos ou desmarque um trevo.');return;}
    update();
  });
  trevoQuantity.addEventListener('change',()=>{const kept=[...selectedTrevos].sort((a,b)=>a-b).slice(0,Number(trevoQuantity.value));selectedTrevos.clear();kept.forEach(n=>selectedTrevos.add(n));update();});
  repeats.addEventListener('change', () => update());
  document.querySelectorAll('#milionaria-view [data-step-control]').forEach(button => button.addEventListener('click', () => {
    const control = byId(button.dataset.stepControl);
    const next = control.selectedIndex + Number(button.dataset.step);
    if (next < 0 || next >= control.options.length) return;
    control.selectedIndex = next;
    control.dispatchEvent(new Event('change'));
  }));
  byId('milionaria-surprise').addEventListener('click', () => {
    selected.clear();selectedTrevos.clear();
    byId('milionaria-random').click();
    byId('milionaria-trevos-random').click();
  });
  byId('milionaria-random').addEventListener('click', () => {
    const pool = Array.from({length:50}, (_, index) => index + 1).filter(number => !selected.has(number));
    for (let index = pool.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [pool[index],pool[other]] = [pool[other],pool[index]];
    }
    pool.slice(0, Number(quantity.value) - selected.size).forEach(number => selected.add(number));
    update();
    if(selected.size===Number(quantity.value)&&selectedTrevos.size===Number(trevoQuantity.value))window.portalDemo.recordGeneratedGame({game:'milionaria',numbers:[...selected],trevos:[...selectedTrevos],repeats:Number(repeats.value)});
  });
  byId('milionaria-trevos-random').addEventListener('click', () => {
    const trevoPool=Array.from({length:6},(_,i)=>i+1).filter(n=>!selectedTrevos.has(n));
    for(let i=trevoPool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[trevoPool[i],trevoPool[j]]=[trevoPool[j],trevoPool[i]];}
    trevoPool.slice(0,Number(trevoQuantity.value)-selectedTrevos.size).forEach(n=>selectedTrevos.add(n));
    update();
    if(selected.size===Number(quantity.value)&&selectedTrevos.size===Number(trevoQuantity.value))window.portalDemo.recordGeneratedGame({game:'milionaria',numbers:[...selected],trevos:[...selectedTrevos],repeats:Number(repeats.value)});
  });
  byId('milionaria-clear').addEventListener('click', () => { selected.clear(); update(); });
  byId('milionaria-trevos-clear').addEventListener('click', () => { selectedTrevos.clear(); update(); });
  byId('milionaria-add').addEventListener('click', () => {
    if (selected.size !== Number(quantity.value) || selectedTrevos.size !== Number(trevoQuantity.value)) return;
    const result = window.portalDemo.addMilionariaGame([...selected], [...selectedTrevos], Number(repeats.value));
    if (!result.ok) { update(result.message); return; }
    selected.clear();selectedTrevos.clear();
    update('Combinação adicionada ao carrinho de demonstração. Escolha novos números ou confira seus jogos.');
  });
  byId('milionaria-view-cart').addEventListener('click', () => window.portalDemo.openCart());
  window.addEventListener('portal:cart-change', updateCart);
  function route() {
    const active=location.hash==='#mais-milionaria';
    document.body.classList.toggle('milionaria-route',active);
    byId('milionaria-view').hidden=!active;
    if(!active) return;
    document.body.classList.add('mega-route');
    ['modalidades','combos','baixar-aplicativo'].forEach(id=>{byId(id).hidden=true;});
    heroTitle.textContent='+Milionária';
    heroSubtitle.textContent='Quer mais? +Milionária! Mais prêmios, com mais chances de ganhar! Aposte!';
    heroTicket.setAttribute('src','assets/reference-milionaria.png');
    document.querySelectorAll('.campaign-menu .active').forEach(item=>item.classList.remove('active'));
    document.querySelector('[data-nav-game="milionaria"]').classList.add('active');
    document.title = 'Loterias Online Caixa';
    window.scrollTo({top:0,behavior:'instant'});
    window.dispatchEvent(new Event('scroll'));
    byId('milionaria-title').focus({preventScroll:true});
    updateCart();
  }
  window.addEventListener('hashchange', route);
  update();updateCart();route();
})();
