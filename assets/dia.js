(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const formatMoney = value => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(value);
  const pad = value => String(value).padStart(2, '0');
  const numbers = byId('dia-numbers');
  const quantity = byId('dia-quantity');
  const repeats = byId('dia-repeats');
  const selected = new Set();
  const month = byId('dia-month');
  const monthList = byId('dia-months');
  window.portalMonths.forEach((name,index) => {
    const option=document.createElement('option');option.value=index;option.textContent=name;month.append(option);
    const button=document.createElement('button');button.type='button';button.dataset.month=index;button.setAttribute('aria-label',name);button.setAttribute('aria-pressed','false');
    const abbreviation=document.createElement('strong');abbreviation.textContent=name.slice(0,3).toLocaleUpperCase('pt-BR');
    const label=document.createElement('span');label.textContent=name;button.append(abbreviation,label);monthList.append(button);
  });
  const monthPrev=byId('dia-month-prev');
  const monthNext=byId('dia-month-next');
  function syncMonthScroll(){
    const maximum=Math.max(0,monthList.scrollWidth-monthList.clientWidth);
    monthPrev.disabled=monthList.scrollLeft<=1;
    monthNext.disabled=monthList.scrollLeft>=maximum-1;
    const width=Math.min(100,monthList.clientWidth/Math.max(1,monthList.scrollWidth)*100);
    const thumb=byId('dia-month-progress-thumb');
    thumb.style.width=`${width}%`;
    thumb.style.left=`${maximum?monthList.scrollLeft/maximum*(100-width):0}%`;
  }
  const moveMonths=direction=>{monthList.scrollBy({left:direction*monthList.clientWidth,behavior:'instant'});syncMonthScroll();};
  monthPrev.addEventListener('click',()=>moveMonths(-1));
  monthNext.addEventListener('click',()=>moveMonths(1));
  monthList.addEventListener('scroll',syncMonthScroll,{passive:true});
  new ResizeObserver(syncMonthScroll).observe(monthList);
  monthList.addEventListener('click',event=>{
    const button=event.target.closest('[data-month]');if(!button)return;
    month.value=month.value===button.dataset.month?'':button.dataset.month;
    update();
  });
  month.addEventListener('change',()=>update());
  const heroTitle = document.querySelector('.hero-copy h1');
  const heroSubtitle = document.querySelector('.hero-copy p');
  const heroTicket = document.querySelector('.campaign-tickets img');
  quantity.innerHTML = Array.from({length:9}, (_, index) => `<option value="${index + 7}">${index + 7}</option>`).join('');
  numbers.innerHTML = Array.from({length:31}, (_, index) => `<button type="button" data-dia-number="${index + 1}" aria-label="Número ${pad(index + 1)}" aria-pressed="false">${pad(index + 1)}</button>`).join('');
  function combinations(n) {
    let value = 1;
    for (let index = 1; index <= 7; index++) value = value * (n - index + 1) / index;
    return Math.round(value);
  }
  function update(message) {
    const target = Number(quantity.value);
    const total = 2.5 * combinations(target) * Number(repeats.value);
    numbers.querySelectorAll('[data-dia-number]').forEach(button => button.setAttribute('aria-pressed', String(selected.has(Number(button.dataset.diaNumber)))));
    byId('dia-counter').textContent = `${selected.size} de ${target} selecionados`;
    byId('dia-total').textContent = formatMoney(total);
    byId('dia-add').disabled = selected.size !== target || month.value === '';
    monthList.querySelectorAll('[data-month]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.month===month.value)));
    document.querySelectorAll('#dia-view [data-step-control]').forEach(button => {
      const control = byId(button.dataset.stepControl);
      const next = control.selectedIndex + Number(button.dataset.step);
      button.disabled = next < 0 || next >= control.options.length;
    });
    byId('dia-message').textContent = message || (selected.size === target ? (month.value===''?'Escolha seu Mês da Sorte para completar a combinação.':'Combinação completa. Você pode adicioná-la ao carrinho.') : `Faltam ${target - selected.size} números para completar sua combinação.`);
  }
  function updateCart() {
    const cart = window.portalDemo.getGames();
    byId('dia-cart-count').textContent = cart.length;
    const preview = byId('dia-cart-preview');
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
    byId('dia-cart-total').textContent = formatMoney(total);
  }
  numbers.addEventListener('click', event => {
    const button = event.target.closest('[data-dia-number]');
    if (!button) return;
    const number = Number(button.dataset.diaNumber);
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
  document.querySelectorAll('#dia-view [data-step-control]').forEach(button => button.addEventListener('click', () => {
    const control = byId(button.dataset.stepControl);
    const next = control.selectedIndex + Number(button.dataset.step);
    if (next < 0 || next >= control.options.length) return;
    control.selectedIndex = next;
    control.dispatchEvent(new Event('change'));
  }));
  byId('dia-surprise').addEventListener('click', () => {
    selected.clear();
    if(month.value==='')month.value=String(Math.floor(Math.random()*12));
    byId('dia-random').click();
  });
  byId('dia-random').addEventListener('click', () => {
    const pool = Array.from({length:31}, (_, index) => index + 1).filter(number => !selected.has(number));
    for (let index = pool.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [pool[index],pool[other]] = [pool[other],pool[index]];
    }
    pool.slice(0, Number(quantity.value) - selected.size).forEach(number => selected.add(number));
    update();
    window.portalDemo.recordGeneratedGame({game:'dia',numbers:[...selected],month:month.value===''?null:Number(month.value),repeats:Number(repeats.value)});
  });
  byId('dia-clear').addEventListener('click', () => { selected.clear(); month.value=''; update(); });
  byId('dia-add').addEventListener('click', () => {
    if (selected.size !== Number(quantity.value) || month.value==='') return;
    const result = window.portalDemo.addDiaGame([...selected], Number(repeats.value), Number(month.value));
    if (!result.ok) { update(result.message); return; }
    selected.clear();
    month.value='';
    update('Combinação adicionada ao carrinho de demonstração. Escolha novos números ou confira seus jogos.');
  });
  byId('dia-view-cart').addEventListener('click', () => window.portalDemo.openCart());
  window.addEventListener('portal:cart-change', updateCart);
  function route() {
    const active = location.hash === '#dia-de-sorte';
    document.body.classList.toggle('dia-route', active);
    byId('dia-view').hidden = !active;
    document.querySelector('[data-nav-game="dia"]').classList.toggle('active', active);
    if (!active) return;
    document.body.classList.add('mega-route');
    ['modalidades','combos','baixar-aplicativo'].forEach(id => { byId(id).hidden = true; });
    document.querySelectorAll('.campaign-menu .active').forEach(item => item.classList.remove('active'));
    document.querySelector('[data-nav-game="dia"]').classList.add('active');
    heroTitle.textContent = 'Dia de Sorte';
    heroSubtitle.textContent = 'Seu dia pode ser uma ótima inspiração para a sorte. Aposte!';
    heroTicket.setAttribute('src', 'assets/dia-de-sorte-ticket.png');
    document.title = 'Portal da Sorte | Demonstração';
    window.scrollTo({top:0,behavior:'instant'});
    window.dispatchEvent(new Event('scroll'));
    byId('dia-title').focus({preventScroll:true});
    requestAnimationFrame(syncMonthScroll);
    updateCart();
  }
  window.addEventListener('hashchange', route);
  update();
  updateCart();
  route();
})();
