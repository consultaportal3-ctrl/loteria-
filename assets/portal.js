(() => {
  'use strict';
  const games = [
    { id: 'mega', name: 'Mega-Sena', color: '#188558', total: 60, count: 6, start: 1, description: 'Uma combinação de seis números para experimentar suas escolhas.' },
    { id: 'facil', name: 'Lotofácil', color: '#963c92', total: 25, count: 15, start: 1, description: 'Monte sua combinação escolhendo quinze números no volante.' },
    { id: 'quina', name: 'Quina', color: '#3253a1', total: 80, count: 5, start: 1, description: 'Cinco números e muitas combinações para você explorar.' },
    { id: 'mania', name: 'Lotomania', color: '#c56619', total: 100, count: 50, start: 0, description: 'Explore um volante de cem números e escolha seus cinquenta.' },
    { id: 'dupla', name: 'Dupla Sena', color: '#b33c50', total: 50, count: 6, start: 1, description: 'Escolha seis números e organize uma nova combinação.' },
    { id: 'dia', name: 'Dia de Sorte', color: '#937015', total: 31, count: 7, start: 1, description: 'Combine sete números e escolha também seu mês da sorte.' },
    { id: 'milionaria', name: '+Milionária', color: '#2b327d', total: 50, count: 6, start: 1, description: 'Escolha seus números e trevos.' },
    { id: 'timemania', name: 'Timemania', color: '#00863d', total: 80, count: 10, start: 1, description: 'Escolha dez números e seu Time do Coração.' },
    { id: 'loteca', name: 'Loteca', color: '#fa1829', description: 'Marque seus palpites para as 14 partidas.' },
    { id: 'super', name: 'Super Sete', color: '#00863d', description: 'Escolha números de 0 a 9 em cada uma das sete colunas.' }
  ];
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  window.portalMonths = Object.freeze([...months]);
  const byId = id => document.getElementById(id);
  const pad = number => String(number).padStart(2, '0');
  const storageKey = 'portal-demo-games-v1';
  const generatedStorageKey = 'portal-demo-generated-games-v1';
  const exampleDraws = {
    mega: {"color":"#00a94f","header":"#00a94f","amount":"20.000.000,00","short":"20 Milhões","contest":"3085","day":"Quinta-Feira","date":"12/11/2026","price":"6,00"},
    facil: {"color":"#92278f","amount":"2.000.000,00","short":"2 Milhões","contest":"3827","day":"Quarta-Feira","date":"11/11/2026","time":"21h00","price":"3,50"},
    quina: {"color":"#32318e","amount":"9.000.000,00","short":"9 Milhões","contest":"7165","day":"Quarta-Feira","date":"11/11/2026","price":"3,00"},
    milionaria: {"color":"#2b327d","amount":"113.000.000,00","short":"113 Milhões","contest":"406","day":"Quarta-Feira","date":"11/11/2026","price":"6,00"},
    mania: {"color":"#ed7900","amount":"4.800.000,00","short":"4,8 Milhões","contest":"2998","day":"Quarta-Feira","date":"11/11/2026","price":"3,00","pool":false},
    timemania: {"color":"#00863d","header":"#fff200","button":"#fff200","amount":"27.000.000,00","short":"27 Milhões","contest":"2467","day":"Quinta-Feira","date":"12/11/2026","price":"3,50"},
    dupla: {"color":"#af2942","amount":"12.200.000,00","short":"12,2 Milhões","contest":"3031","day":"Quarta-Feira","date":"11/11/2026","price":"3,00"},
    loteca: {"color":"#fa1829","amount":"500.000,00","short":"500 Mil","contest":"1282","day":"Quinta-Feira","date":"12/11/2026","time":"13h00","label":"Apuração","price":"4,00"},
    dia: {"color":"#ad9718","header":"#e8c41e","amount":"100.000,00","short":"100 Mil","contest":"1345","day":"Quarta-Feira","date":"11/11/2026","price":"2,50"},
    super: {"color":"#00863d","header":"#bddb29","button":"#85a332","amount":"300.000,00","short":"300 Mil","contest":"921","day":"Quarta-Feira","date":"11/11/2026","price":"3,00"}
  };
  const products = [
    ...(window.homeProductReference ? [{id:'virada',name:'Mega da Virada',route:'virada'}] : []),
    ...games.slice(0, 3),
    games.find(game => game.id === 'milionaria'),
    games.find(game => game.id === 'mania'),
    games.find(game => game.id === 'timemania'),
    games.find(game => game.id === 'dupla'),
    games.find(game => game.id === 'loteca'),
    games.find(game => game.id === 'dia'),
    games.find(game => game.id === 'super')
  ];
  let cart = [];
  let activeGame = games[0];
  let selection = new Set();
  let toastTimer;
  const validMega = (numbers, repeats = 1) => Array.isArray(numbers) && numbers.length >= 6 && numbers.length <= 20 && new Set(numbers).size === numbers.length && numbers.every(number => Number.isInteger(number) && number >= 1 && number <= 60) && [1,2,3,4,6,8,9,12].includes(repeats);
  const validFacil = (numbers, repeats = 1) => Array.isArray(numbers) && numbers.length >= 15 && numbers.length <= 20 && new Set(numbers).size === numbers.length && numbers.every(number => Number.isInteger(number) && number >= 1 && number <= 25) && [1,2,3,4,6,8,9,12,18,24].includes(repeats);
  const validQuina = (numbers, repeats = 1) => Array.isArray(numbers) && numbers.length >= 5 && numbers.length <= 15 && new Set(numbers).size === numbers.length && numbers.every(number => Number.isInteger(number) && number >= 1 && number <= 80) && [1,3,6,12,18,24].includes(repeats);
  const validDupla = (numbers, repeats = 1) => Array.isArray(numbers) && numbers.length >= 6 && numbers.length <= 15 && new Set(numbers).size === numbers.length && numbers.every(number => Number.isInteger(number) && number >= 1 && number <= 50) && [1,2,3,4,6,8,9,12].includes(repeats);
  const validDia = (numbers, repeats, month) => Array.isArray(numbers) && numbers.length >= 7 && numbers.length <= 15 && new Set(numbers).size === numbers.length && numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 31) && [1,3,6,9,12,18,24].includes(repeats) && Number.isInteger(month) && month >= 0 && month < 12;
  const validMania = (numbers, repeats = 1) => Array.isArray(numbers) && numbers.length === 50 && new Set(numbers).size === 50 && numbers.every(n => Number.isInteger(n) && n >= 0 && n <= 99) && [1,2,3,4,6,8,9,12].includes(repeats);
  const validTimemania = (numbers, repeats, team) => Array.isArray(numbers) && numbers.length === 10 && new Set(numbers).size === 10 && numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 80) && [1,3,6,9,12].includes(repeats) && window.timemaniaTeams.includes(team);
  const validMilionaria = (numbers,trevos,repeats=1) => Array.isArray(numbers) && numbers.length>=6 && numbers.length<=12 && new Set(numbers).size===numbers.length && numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=50) && Array.isArray(trevos) && trevos.length>=2 && trevos.length<=6 && new Set(trevos).size===trevos.length && trevos.every(n=>Number.isInteger(n)&&n>=1&&n<=6) && [1,2,3,4,5].includes(repeats);
  const choose = (n,k) => { let value=1; for(let i=1;i<=k;i++) value=value*(n-i+1)/i; return Math.round(value); };
  const referencePrice = item => { if(item.game==='super') return window.superSeteRules.price(item.columns,item.repeats); if(item.game==='loteca') return window.lotecaRules.price(item.picks); if(item.game==='milionaria') return 6*choose(item.numbers.length,6)*choose(item.trevos.length,2)*(item.repeats||1); const rule={mega:[6,6],facil:[3.5,15],quina:[3,5],mania:[3,50],timemania:[3.5,10],dupla:[3,6],dia:[2.5,7]}[item.game]; return rule[0]*choose(item.numbers.length,rule[1])*(item.repeats || 1); };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) cart = saved.filter(item => {
      const game = games.find(candidate => candidate.id === item?.game);
      return game && (game.id === 'mega' ? validMega(item.numbers, item.repeats ?? 1) : game.id === 'facil' ? validFacil(item.numbers, item.repeats ?? 1) : game.id === 'super' ? window.superSeteRules.valid(item.columns,item.repeats ?? 1) : game.id === 'dia' ? validDia(item.numbers, item.repeats ?? 1, item.month) : game.id === 'loteca' ? window.lotecaRules.valid(item.picks,item.contest) : game.id === 'dupla' ? validDupla(item.numbers, item.repeats ?? 1) : game.id === 'quina' ? validQuina(item.numbers, item.repeats ?? 1) : game.id === 'timemania' ? validTimemania(item.numbers, item.repeats ?? 1, item.team) : game.id === 'mania' ? validMania(item.numbers, item.repeats ?? 1) : game.id === 'milionaria' ? validMilionaria(item.numbers,item.trevos,item.repeats ?? 1) : Array.isArray(item.numbers) && item.numbers.length === game.count && new Set(item.numbers).size === game.count && item.numbers.every(number => Number.isInteger(number) && number >= game.start && number < game.start + game.total)) && (game.id !== 'dia' || (Number.isInteger(item.month) && item.month >= 0 && item.month < 12));
    }).slice(0, 30).map(item => ({ game: item.game, ...(Number.isInteger(item.contest)&&item.contest>0?{contest:item.contest}:{}), ...(item.game === 'mega' && item.special === 'virada' ? {special:'virada',contest:3100} : {}), numbers: ['loteca','super'].includes(item.game) ? [] : [...item.numbers].sort((a, b) => a - b), month: item.game === 'dia' ? item.month : null, ...(item.game === 'super' ? {columns:item.columns.map(column=>[...column].sort((a,b)=>a-b))} : {}), ...(item.game === 'loteca' ? {picks:[...item.picks],contest:item.contest} : {}), ...(item.game === 'timemania' ? {team:item.team} : {}), ...(item.game === 'milionaria' ? {trevos:[...item.trevos].sort((a,b)=>a-b)} : {}), repeats: ['mega','facil','quina','milionaria','mania','timemania','dupla','dia','super'].includes(item.game) ? item.repeats ?? 1 : 1 }));
  } catch (_) {}
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch (_) {}
    byId('cart-count').textContent = cart.length;
    byId('open-cart').setAttribute('aria-label', `Meus jogos: ${cart.length} combinações`);
    document.querySelectorAll('[data-view-all-bets]').forEach(button => { button.hidden = cart.length <= 6; });
    window.dispatchEvent(new CustomEvent('portal:cart-change'));
  }
  function toast(message) {
    clearTimeout(toastTimer);
    byId('toast').textContent = message;
    byId('toast').hidden = false;
    toastTimer = setTimeout(() => { byId('toast').hidden = true; }, 3500);
  }
  function renderCards(filter = '') {
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const visible = products.filter(game => normalize(game.name).includes(normalize(filter)));
    byId('game-cards').innerHTML = visible.map(game => {
      const draw = window.homeProductReference?.draws[game.id] || exampleDraws[game.id];
      const gameRoute = game.route || game.id;
      const color = draw?.color || game.color;
      const prizeAmount = game.id === 'virada' ? `<span>R$</span>${draw.amount}` : `R$ ${draw.amount}`;
      const countdown = draw.close ? `<span data-product-close="${draw.close}">${window.homeProductReference.countdown(draw.close)}</span>` : '<span>Calendário da imagem de referência</span>';
      const prize = `<div class="product-prize"><strong>${prizeAmount}</strong><b>(R$${draw.short})</b></div><p class="product-contest">${draw.close ? 'Prêmio estimado' : 'Exemplo de prêmio'} do concurso ${draw.contest}</p><p class="product-draw">${draw.label || 'Sorteio'} <strong>${draw.day}<br>${draw.date} às ${draw.time || '21h00'}</strong>${countdown}</p>`;
      const action = game.external ? `<a class="product-play" href="#informacoes" data-local-info>Ver modalidade<span>Referência: R$ ${draw.price}</span></a>` : `<button type="button" class="product-play" data-game="${gameRoute}">Aposte<span>por R$ ${draw.price}</span></button>`;
      const pool = draw.pool === false ? '' : `<button type="button" class="product-pool" data-game="${gameRoute}" aria-label="Compre seu bolão de ${game.name}: abrir aposta">Compre seu bolão</button><span class="product-or">ou</span>`;
      return `<article class="game-card product-card product-${game.id}${draw.pool === false ? ' product-no-pool' : ''}" style="--game-color:${color};--product-header:${draw.header || color};--product-button:${draw.button || color}"><header class="product-header"><span class="product-clover" aria-hidden="true"><i></i><i></i><i></i><i></i></span><h3>${game.name.toLowerCase()}</h3></header><div class="product-body">${prize}${pool}${action}</div></article>`;
    }).join('');
    byId('no-results').hidden = visible.length > 0;
  }
  function updateSelection() {
    byId('selection-count').textContent = `${selection.size} de ${activeGame.count} selecionados`;
    byId('number-grid').querySelectorAll('[data-number]').forEach(button => button.setAttribute('aria-pressed', selection.has(Number(button.dataset.number)) ? 'true' : 'false'));
    byId('add-game').disabled = selection.size !== activeGame.count;
    byId('selection-hint').textContent = selection.size === activeGame.count ? 'Combinação completa. Você já pode adicionar aos seus jogos.' : `Selecione mais ${activeGame.count - selection.size} número(s) para completar.`;
  }
  function openGame(id) {
    if (['virada','mega','facil','quina','milionaria','mania','timemania','dupla','loteca','dia','super'].includes(id)) {
      window.location.hash = {virada:'mega-da-virada',mega:'mega-sena',facil:'lotofacil',quina:'quina',milionaria:'mais-milionaria',mania:'lotomania',timemania:'timemania',dupla:'dupla-sena',loteca:'loteca',dia:'dia-de-sorte',super:'super-sete'}[id];
      return;
    }
    activeGame = games.find(game => game.id === id);
    if (!activeGame) return;
    selection = new Set();
    const dialog = byId('game-dialog');
    dialog.style.setProperty('--game-color', activeGame.color);
    byId('game-title').textContent = activeGame.name;
    byId('game-instructions').textContent = `Escolha ${activeGame.count} números entre ${pad(activeGame.start)} e ${pad(activeGame.start + activeGame.total - 1)}.`;
    byId('number-grid').innerHTML = Array.from({ length: activeGame.total }, (_, index) => {
      const number = index + activeGame.start;
      return `<button class="number-button" type="button" data-number="${number}" aria-label="Número ${pad(number)}" aria-pressed="false">${pad(number)}</button>`;
    }).join('');
    const previousMonth = byId('month-choice');
    if (previousMonth) previousMonth.remove();
    if (activeGame.id === 'dia') {
      const label = document.createElement('label');
      label.id = 'month-choice';
      label.className = 'month-choice';
      label.innerHTML = `Mês da sorte <select id="lucky-month">${months.map((month, index) => `<option value="${index}">${month}</option>`).join('')}</select>`;
      byId('number-grid').after(label);
    }
    updateSelection();
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  function renderCart() {
    const area = byId('cart-items');
    area.replaceChildren();
    if (!cart.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Seu carrinho está vazio. Escolha uma modalidade para começar.';
      area.append(empty);
    }
    cart.forEach((item, index) => {
      const game = {...games.find(candidate => candidate.id === item.game)};
      if (item.special === 'virada') game.name = 'Mega da Virada';
      const article = document.createElement('article');
      article.className = 'cart-item';
      article.dataset.game=item.game;
      article.style.setProperty('--game-color', exampleDraws[game.id].color);
      article.innerHTML = `<div class="cart-item-top"><h3>${game.name}</h3><button class="text-button cart-remove" type="button" data-remove="${index}" aria-label="Remover jogo ${index + 1} de ${game.name}"><svg width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 9v9M14 9v9"/></svg></button></div><div class="cart-bet-content"><div class="cart-balls">${(item.columns ? window.superSeteRules.labels(item.columns) : item.picks ? window.lotecaRules.labels(item.picks) : item.numbers.map(pad)).map(label => `<span>${label}</span>`).join('')}</div>${game.id === 'dia' ? `<p class="hint">Mês da sorte: ${months[item.month]}</p>` : ''}</div>`;
      const content=article.querySelector('.cart-bet-content');
      if(item.columns){
        const columns=content.querySelector('.cart-balls');columns.classList.add('cart-super-columns');
        window.superSeteRules.renderColumns(columns,item.columns);
      }
      if (item.trevos) {
        const trevos = document.createElement('p');
        trevos.className = 'cart-trevos';
        const trevoLabel=document.createElement('span');trevoLabel.className='cart-accessible-title';trevoLabel.textContent='Trevos: ';trevos.append(trevoLabel);
        item.trevos.forEach(number=>{
          const clover=document.createElement('span');
          clover.className='recent-trevo';
          clover.setAttribute('aria-label',`Trevo ${number}`);
          clover.innerHTML=`<svg viewBox="0 0 54 54" aria-hidden="true"><path d="M27 9C22-2 10 0 11 12C0 9-3 23 9 27C-3 31 0 45 11 42C10 54 22 56 27 45C32 56 44 54 43 42C54 45 57 31 45 27C57 23 54 9 43 12C44 0 32-2 27 9Z"/></svg><b>${number}</b>`;
          trevos.append(clover);
        });
        content.append(trevos);
      }
      area.prepend(article);
      if (item.team) {
        const teamDetails = document.createElement('p');
        teamDetails.className = 'hint';
        teamDetails.textContent = `Time do Coração: ${item.team}`;
        content.append(teamDetails);
      }
      if (['mega','facil','quina','milionaria','mania','timemania','dupla','dia','super'].includes(game.id) && item.repeats > 1) {
        const repeatNote = document.createElement('p');
        repeatNote.className = 'hint cart-repeat-note';
        repeatNote.textContent = `Teimosinha: ${item.repeats} concursos · demonstração`;
        content.append(repeatNote);
      }
      const first=item.contest||Number(exampleDraws[item.game].contest);
      const metadata=[['cart-contest','Concurso',`${first}${item.repeats>1?' a '+(first+item.repeats-1):''}`],['cart-date','Data do sorteio',item.special === 'virada' ? '01/01/2027' : exampleDraws[item.game].date],['cart-item-value','Valor da aposta',formatCartMoney(referencePrice(item))]];
      metadata.forEach(([className,label,value])=>{const cell=document.createElement('div');cell.className=className;const caption=document.createElement('span');caption.className='cart-meta-label';caption.textContent=label;const text=document.createElement('span');text.textContent=value;cell.append(caption,text);article.append(cell);});
      if(item.game!=='loteca' && item.special !== 'virada'){
        const options=cartRepeatOptions(item.game), position=options.indexOf(item.repeats||1);
        const controls=document.createElement('div');controls.className='cart-repeat';
        controls.innerHTML=`<span>Teimosinhas <b title="Repita a combinação em concursos consecutivos">?</b></span><div><button type="button" data-cart-repeat="${index}" data-step="-1" aria-label="Diminuir teimosinhas" ${position<=0?'disabled':''}>−</button><output>${item.repeats>1?item.repeats:0}</output><button type="button" data-cart-repeat="${index}" data-step="1" aria-label="Aumentar teimosinhas" ${position===options.length-1?'disabled':''}>+</button></div>`;
        article.querySelector('.cart-contest').append(controls);
      }
    });
    byId('cart-summary').textContent = `Total de ${cart.length} aposta${cart.length===1?'':'s'}`;
    byId('cart-total').textContent=formatCartMoney(cart.reduce((sum,item)=>sum+referencePrice(item),0));
    byId('cart-clear').disabled=cart.length===0;
    document.querySelector('[data-cart-clear]').disabled=cart.length===0;
    byId('finish-demo').disabled = cart.length === 0;
    document.querySelector('[data-cart-payment]').disabled=cart.length===0;
  }
  function cartRepeatOptions(game){return ({mega:[1,2,3,4,6,8,9,12],facil:[1,2,3,4,6,8,9,12,18,24],quina:[1,3,6,12,18,24],milionaria:[1,2,3,4,5],mania:[1,2,3,4,6,8,9,12],timemania:[1,3,6,9,12],dupla:[1,2,3,4,6,8,9,12],dia:[1,3,6,9,12,18,24],super:[1,3,6,9,12]})[game]||[1];}
  byId('cart-items').addEventListener('click',event=>{
    const button=event.target.closest('[data-cart-repeat]');if(!button)return;
    const index=Number(button.dataset.cartRepeat), item=cart[index];if(!item)return;
    const options=cartRepeatOptions(item.game),next=options.indexOf(item.repeats||1)+Number(button.dataset.step);
    if(next<0||next>=options.length)return;
    item.repeats=options[next];persist();renderCart();
    byId('cart-items').querySelector(`[data-cart-repeat="${index}"][data-step="${button.dataset.step}"]`).focus();
  });
  function showHomeStart() {
    window.scrollTo({top:0,left:0,behavior:'instant'});
    window.dispatchEvent(new Event('scroll'));
  }
  document.querySelector('.header-official')?.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (new URL(event.currentTarget.href).pathname !== location.pathname) return;
    event.preventDefault();
    if (location.hash !== '#inicio') {
      window.addEventListener('hashchange', () => requestAnimationFrame(showHomeStart), {once:true});
      location.hash = 'inicio';
    } else showHomeStart();
  });
  window.addEventListener('pageshow', () => {
    if (location.hash === '#inicio') document.fonts.ready.then(() => requestAnimationFrame(showHomeStart));
  });
  byId('game-cards').addEventListener('click', event => {
    const button = event.target.closest('[data-game]');
    if (button) openGame(button.dataset.game);
  });
  document.querySelectorAll('[data-nav-game]').forEach(button => button.addEventListener('click', () => openGame(button.dataset.navGame)));
  byId('number-grid').addEventListener('click', event => {
    const button = event.target.closest('[data-number]');
    if (!button) return;
    const number = Number(button.dataset.number);
    if (selection.has(number)) selection.delete(number);
    else if (selection.size < activeGame.count) selection.add(number);
    else {
      byId('selection-hint').textContent = 'Sua combinação está completa. Desmarque um número para escolher outro.';
      return;
    }
    updateSelection();
  });
  byId('random-numbers').addEventListener('click', () => {
    const pool = Array.from({ length: activeGame.total }, (_, index) => index + activeGame.start);
    for (let index = pool.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[target]] = [pool[target], pool[index]];
    }
    selection = new Set(pool.slice(0, activeGame.count));
    if (activeGame.id === 'dia') byId('lucky-month').value = String(Math.floor(Math.random() * months.length));
    updateSelection();
    window.portalDemo.recordGeneratedGame({game:activeGame.id,numbers:[...selection],month:activeGame.id==='dia'?Number(byId('lucky-month').value):null,repeats:1});
  });
  byId('clear-numbers').addEventListener('click', () => { selection.clear(); updateSelection(); });
  byId('add-game').addEventListener('click', () => {
    if (selection.size !== activeGame.count) return;
    if (cart.length >= 30) {
      byId('selection-hint').textContent = 'Limite de 30 combinações. Remova um jogo do carrinho antes de adicionar outro.';
      return;
    }
    cart.push({ game: activeGame.id, numbers: [...selection].sort((a, b) => a - b), month: activeGame.id === 'dia' ? Number(byId('lucky-month').value) : null });
    persist();
    byId('game-dialog').close();
    toast(`${activeGame.name} adicionada aos seus jogos.`);
  });
  const formatCartMoney=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
  function openCartPage(){renderCart();window.portalCartPage.open();}
  byId('open-cart').addEventListener('click',event=>{event.preventDefault();openCartPage();});
  document.querySelectorAll('[data-view-all-bets]').forEach(button => button.addEventListener('click',openCartPage));
  byId('cart-clear').addEventListener('click',()=>{cart=[];persist();renderCart();});
  byId('cart-items').addEventListener('click', event => {
    const button = event.target.closest('[data-remove]');
    if (!button) return;
    const index = Number(button.dataset.remove);
    cart.splice(index, 1);
    persist();
    renderCart();
    const next = byId('cart-items').querySelector(`[data-remove="${Math.min(index, cart.length - 1)}"]`);
    (next || byId('cart-dialog').querySelector('[data-close]')).focus();
  });
  byId('finish-demo').addEventListener('click', () => {
    if (!cart.length) return;
    toast('O checkout não carregou. Atualize a página e tente novamente. Seu carrinho foi mantido.');
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
    if(button.dataset.close==='cart-dialog'&&window.portalCartPage)window.portalCartPage.close();
    else byId(button.dataset.close).close();
  }));
  const navigation = document.querySelector('.campaign-navigation');
  const navigationSlot = document.createElement('div');
  navigationSlot.className = 'campaign-navigation-slot';
  navigation.before(navigationSlot);
  navigationSlot.append(navigation);
  function syncNavigation() {
    const shouldFix = navigationSlot.getBoundingClientRect().top < 0;
    if (shouldFix && !navigation.classList.contains('is-fixed')) {
      navigationSlot.style.height = `${navigation.offsetHeight}px`;
      navigation.classList.add('is-fixed');
      document.body.append(navigation);
    } else if (!shouldFix && navigation.classList.contains('is-fixed')) {
      navigation.classList.remove('is-fixed');
      navigationSlot.append(navigation);
      navigationSlot.style.height = '';
    }
    document.documentElement.style.setProperty('--fixed-navigation-height', navigation.classList.contains('is-fixed') ? `${navigation.offsetHeight}px` : '0px');
  }
  window.addEventListener('scroll', syncNavigation, { passive: true });
  window.addEventListener('resize', () => {
    if (navigation.classList.contains('is-fixed')) {
      navigation.classList.remove('is-fixed');
      navigationSlot.append(navigation);
      navigationSlot.style.height = '';
    }
    syncNavigation();
  });
  window.portalDemo = {
    getGames: () => cart.map(item => ({ ...item, numbers: [...item.numbers], ...(item.trevos ? {trevos:[...item.trevos]} : {}), ...(item.picks ? {picks:[...item.picks]} : {}), ...(item.columns ? {columns:item.columns.map(column=>[...column])} : {}), referencePrice: referencePrice(item), name: item.special === 'virada' ? 'Mega da Virada' : games.find(game => game.id === item.game).name })),
    recordGeneratedGame: item => {
      try {
        const saved=JSON.parse(localStorage.getItem(generatedStorageKey)||'[]');
        if(!Array.isArray(saved))throw new Error('Invalid generated combinations data');
        saved.push({...item,generatedAt:new Date().toISOString()});
        localStorage.setItem(generatedStorageKey,JSON.stringify(saved));
        window.dispatchEvent(new CustomEvent('portal:generated-game', {detail:{...item}}));
        return true;
      } catch {
        toast('Não foi possível salvar a combinação gerada neste navegador.');
        return false;
      }
    },
    openCart: openCartPage,
    addMonthlyCombo: (quantity=1) => window.portalDemo.addComboPack('monthly',quantity),
    addElasCombo: (quantity=1) => window.portalDemo.addComboPack('elas',quantity),
    addChanceCombo: (quantity=1) => window.portalDemo.addComboPack('chance',quantity),
    addMilionarioCombo: (quantity=1) => window.portalDemo.addComboPack('milionario',quantity),
    addSorteCombo: (quantity=1) => window.portalDemo.addComboPack('sorte',quantity),
    addVipCombo: (quantity=1) => window.portalDemo.addComboPack('vip',quantity),
    addComboPack: (kind,quantity=1) => {
      if(!['monthly','elas','chance','milionario','sorte','vip','virada'].includes(kind))return {ok:false,message:'Combo indisponível.'};
      const betCount={monthly:9,elas:7,chance:10,milionario:12,sorte:20,vip:4,virada:4}[kind], maxQuantity=Math.floor(30/betCount);
      if(!Number.isInteger(quantity)||quantity<1||quantity>maxQuantity)return {ok:false,message:`Escolha de 1 a ${maxQuantity} pacotes.`};
      if(cart.length+betCount*quantity>30)return {ok:false,message:'Não há espaço para o combo completo. Remova apostas do carrinho antes de continuar.'};
      const randomNumbers=(total,count,start=1)=>{
        const pool=Array.from({length:total},(_,i)=>i+start);
        for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
        return pool.slice(0,count).sort((a,b)=>a-b);
      };
      const additions=[];
      for(let unit=0;unit<quantity;unit++){
        const specifications={
          virada:Array.from({length:4},()=>['mega',60,6,1]),
          elas:[['facil',25,15,1],['quina',80,5,1],['dupla',50,6,1],['dia',31,7,1]],
          monthly:[['mega',60,6,12],['facil',25,15,24],['quina',80,5,6],['milionaria',50,6,5],['dupla',50,6,12],['dia',31,7,24]],
          chance:[['mega',60,6,6],['facil',25,15,6],['quina',80,5,6],['milionaria',50,6,2],['dupla',50,6,3],['timemania',80,10,3],['dia',31,7,6]],
          milionario:[['mega',60,6,1],['facil',25,15,1],['milionaria',50,6,1],['dupla',50,6,1],['timemania',80,10,1]].flatMap(spec=>[spec,spec]),
          sorte:[...Array.from({length:8},()=>['facil',25,15,1]),...Array.from({length:6},()=>['dia',31,7,1])],
          vip:[['mega',60,10,1],['facil',25,16,1],['quina',80,8,1],['milionaria',50,8,1]]
        }[kind];
        for(const [game,total,count,repeats] of specifications){
          additions.push({game,...(['monthly','elas'].includes(kind)?{contest:{mega:3085,facil:3827,quina:7165,milionaria:406,dupla:3031,mania:2998,dia:1345,super:921}[game]}:{}),...(kind==='virada'?{special:'virada',contest:3100}:{}),numbers:randomNumbers(total,count),repeats,month:game==='dia'?Math.floor(Math.random()*12):null,...(game==='milionaria'?{trevos:randomNumbers(6,2)}:{}),...(game==='timemania'?{team:window.timemaniaTeams[Math.floor(Math.random()*window.timemaniaTeams.length)]}:{})});
        }
        if(kind==='milionario'){
          for(let game=0;game<2;game++)additions.push({game:'super',...(kind==='monthly'?{contest:921}:{}),numbers:[],columns:Array.from({length:7},()=>[Math.floor(Math.random()*10)]),month:null,repeats:1});
        }
        if(kind==='monthly'||kind==='chance'||kind==='sorte'||kind==='elas'){
        const repeats=kind==='sorte'||kind==='elas'?1:kind==='chance'?3:12;
        const numbers=randomNumbers(100,50,0), selected=new Set(numbers);
        additions.push({game:'mania',...(kind==='monthly'?{contest:2998}:{}),numbers,month:null,repeats},{game:'mania',...(kind==='monthly'?{contest:2998}:{}),numbers:Array.from({length:100},(_,i)=>i).filter(n=>!selected.has(n)),month:null,repeats});
        for(let game=0;game<(kind==='sorte'?4:1);game++)additions.push({game:'super',...(kind==='monthly'?{contest:921}:{}),numbers:[],columns:Array.from({length:7},()=>[Math.floor(Math.random()*10)]),month:null,repeats});
        }
      }
      cart.push(...additions);persist();
      return {ok:true,count:additions.length,total:additions.reduce((sum,item)=>sum+referencePrice(item),0)};
    },
    removeGame: index => {
      if (!Number.isInteger(index) || index < 0 || index >= cart.length) return false;
      cart.splice(index, 1);
      persist();
      return true;
    },
    addMilionariaGame: (numbers,trevos,repeats) => {
      if (!validMilionaria(numbers,trevos,repeats)) return {ok:false,message:'Confira os números, trevos e concursos.'};
      if (cart.length>=30) return {ok:false,message:'O carrinho já tem 30 combinações.'};
      cart.push({game:'milionaria',contest:406,numbers:[...numbers].sort((a,b)=>a-b),trevos:[...trevos].sort((a,b)=>a-b),month:null,repeats});
      persist();return {ok:true};
    },
    addManiaGame: (numbers, repeats, mirror = false) => {
      if (!validMania(numbers, repeats) || typeof mirror !== 'boolean') return {ok:false,message:'Escolha 50 números de 00 a 99 e confira os concursos.'};
      if (cart.length + (mirror ? 2 : 1) > 30) return {ok:false,message:'Não há espaço no carrinho para esta combinação. Remova um jogo antes de continuar.'};
      cart.push({game:'mania',contest:2998,numbers:[...numbers].sort((a,b)=>a-b),month:null,repeats});
      if (mirror) {
        const original = new Set(numbers);
        cart.push({game:'mania',contest:2998,numbers:Array.from({length:100},(_,i)=>i).filter(n=>!original.has(n)),month:null,repeats});
      }
      persist();
      return {ok:true};
    },
    addTimemaniaGame: (numbers, repeats, team) => {
      if (!validTimemania(numbers, repeats, team)) return {ok:false,message:'Escolha 10 números, um Time do Coração e confira os concursos.'};
      if (cart.length >= 30) return {ok:false,message:'O carrinho já tem 30 combinações. Remova um jogo antes de continuar.'};
      cart.push({game:'timemania',contest:2467,numbers:[...numbers].sort((a,b)=>a-b),month:null,repeats,team});
      persist();
      return {ok:true};
    },
    addQuinaGame: (numbers, repeats) => {
      if (!validQuina(numbers, repeats)) return { ok: false, message: 'Confira os números e a quantidade de concursos.' };
      if (cart.length >= 30) return { ok: false, message: 'O carrinho já tem 30 combinações.' };
      cart.push({ game: 'quina', contest:7165, numbers: [...numbers].sort((a,b) => a-b), month: null, repeats });
      persist();
      return { ok: true };
    },
    addDuplaGame: (numbers, repeats) => {
      if (!validDupla(numbers, repeats)) return {ok:false,message:'Escolha de 6 a 15 números e confira os concursos.'};
      if (cart.length >= 30) return {ok:false,message:'O carrinho já tem 30 combinações. Remova um jogo antes de continuar.'};
      cart.push({game:'dupla',contest:3031,numbers:[...numbers].sort((a,b)=>a-b),month:null,repeats});
      persist();
      return {ok:true};
    },
    addDiaGame: (numbers, repeats, month) => {
      if (!validDia(numbers, repeats, month)) return {ok:false,message:'Escolha de 7 a 15 números, um Mês da Sorte e confira os concursos.'};
      if (cart.length >= 30) return {ok:false,message:'O carrinho já tem 30 combinações. Remova um jogo antes de continuar.'};
      cart.push({game:'dia',contest:1345,numbers:[...numbers].sort((a,b)=>a-b),month,repeats});
      persist();
      return {ok:true};
    },
    addLotecaGame: picks => {
      if (!window.lotecaRules.valid(picks, window.lotecaData.contest)) return {ok:false,message:'Marque os 14 jogos e inclua ao menos um duplo ou triplo, dentro dos limites do volante.'};
      if (cart.length >= 30) return {ok:false,message:'O carrinho já tem 30 combinações. Remova um jogo antes de continuar.'};
      cart.push({game:'loteca',numbers:[],picks:[...picks],contest:window.lotecaData.contest,month:null,repeats:1});
      persist();
      return {ok:true};
    },
    addSuperGame: (columns,repeats=1) => {
      if(!window.superSeteRules.valid(columns,repeats))return {ok:false,message:'Confira as sete colunas, a distribuição dos números e os concursos.'};
      if(cart.length>=30)return {ok:false,message:'O carrinho já tem 30 combinações. Remova um jogo antes de continuar.'};
      cart.push({game:'super',contest:921,numbers:[],columns:columns.map(column=>[...column].sort((a,b)=>a-b)),month:null,repeats});
      persist();return {ok:true};
    },
    addFacilGame: (numbers, repeats) => {
      if (!validFacil(numbers, repeats)) return { ok: false, message: 'Confira os números e a quantidade de concursos.' };
      if (cart.length >= 30) return { ok: false, message: 'O carrinho já tem 30 combinações.' };
      cart.push({ game: 'facil', contest:3827, numbers: [...numbers].sort((a,b) => a-b), month: null, repeats });
      persist();
      return { ok: true };
    },
    addMegaGame: (numbers, repeats, virada = false) => {
      if (virada) repeats = 1;
      if (!validMega(numbers, repeats)) return { ok: false, message: 'Confira os números e a quantidade de concursos.' };
      if (cart.length >= 30) return { ok: false, message: 'O carrinho já tem 30 combinações. Remova um jogo antes de adicionar outro.' };
      cart.push({ game: 'mega', ...(virada ? {special:'virada',contest:3100} : {contest:3085}), numbers: [...numbers].sort((a, b) => a - b), month: null, repeats });
      persist();
      return { ok: true };
    }
  };
  syncNavigation();
  renderCards();
  persist();
})();
