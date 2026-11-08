(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const formatMoney=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
  const pad=value=>String(value).padStart(2,'0');
  const rules=window.superSeteRules;
  const columns=Array.from({length:7},()=>new Set());
  const values=()=>columns.map(column=>[...column].sort((a,b)=>a-b));
  const quantity=byId('super-quantity');const repeats=byId('super-repeats');
  const board=byId('super-columns');
  quantity.innerHTML=Array.from({length:15},(_,i)=>`<option value="${i+7}">${i+7}</option>`).join('');
  columns.forEach((_,index)=>{
    const group=document.createElement('div');group.className='super-column';group.setAttribute('role','group');group.setAttribute('aria-label',`Coluna ${index+1}`);
    const title=document.createElement('h3');title.textContent=index+1;group.append(title);
    for(let number=0;number<10;number++){
      const button=document.createElement('button');button.type='button';button.dataset.superColumn=index;button.dataset.superNumber=number;button.textContent=number;button.setAttribute('aria-label',`Coluna ${index+1}, número ${number}`);button.setAttribute('aria-pressed','false');group.append(button);
    }
    board.append(group);
  });
  const limits=()=>({min:Number(quantity.value)>14?2:1,max:Number(quantity.value)===7?1:Number(quantity.value)<=14?2:3});
  function update(message){
    const selected=values();const count=rules.total(selected);const target=Number(quantity.value);
    board.querySelectorAll('[data-super-number]').forEach(button=>button.setAttribute('aria-pressed',String(columns[Number(button.dataset.superColumn)].has(Number(button.dataset.superNumber)))));
    byId('super-counter').textContent=`${count} de ${target} números selecionados`;
    byId('super-total').textContent=formatMoney(rules.targetPrice(target,Number(repeats.value)));
    byId('super-add').disabled=count!==target||!rules.valid(selected,Number(repeats.value));
    byId('super-message').textContent=message||(count<target?`Faltam ${target-count} números para completar. Respeite a quantidade por coluna.`:rules.valid(selected,Number(repeats.value))?'Combinação completa. Você pode adicioná-la ao carrinho.':'Distribua os números entre as sete colunas, respeitando os limites por coluna.');
    document.querySelectorAll('#super-view [data-step-control]').forEach(button=>{const control=byId(button.dataset.stepControl);const next=control.selectedIndex+Number(button.dataset.step);button.disabled=next<0||next>=control.options.length;});
  }
  board.addEventListener('click',event=>{
    const button=event.target.closest('[data-super-number]');if(!button)return;
    const column=columns[Number(button.dataset.superColumn)];const number=Number(button.dataset.superNumber);
    if(column.has(number))column.delete(number);
    else if(column.size>=limits().max){update(`Você pode marcar até ${limits().max} número(s) em cada coluna nesta aposta.`);return;}
    else if(rules.total(values())>=Number(quantity.value)){update('Desmarque outro número ou aumente a quantidade da aposta.');return;}
    else column.add(number);
    update();
  });
  quantity.addEventListener('change',()=>{
    const {min,max}=limits();
    columns.forEach(column=>{[...column].sort((a,b)=>a-b).slice(max).forEach(number=>column.delete(number));});
    while(rules.total(values())>Number(quantity.value)){
      const column=[...columns].sort((a,b)=>b.size-a.size).find(column=>column.size>min);
      if(!column)break;column.delete([...column].pop());
    }
    update();
  });
  repeats.addEventListener('change',()=>update());
  document.querySelectorAll('#super-view [data-step-control]').forEach(button=>button.addEventListener('click',()=>{
    const control=byId(button.dataset.stepControl);const next=control.selectedIndex+Number(button.dataset.step);
    if(next<0||next>=control.options.length)return;control.selectedIndex=next;control.dispatchEvent(new Event('change'));
  }));
  byId('super-random').addEventListener('click',()=>{
    const {min,max}=limits();
    const addDigit=column=>{const pool=Array.from({length:10},(_,i)=>i).filter(n=>!column.has(n));column.add(pool[Math.floor(Math.random()*pool.length)]);};
    // Preserve existing digits while making room for required marks in every column.
    const target=Number(quantity.value);
    while(columns.reduce((sum,column)=>sum+Math.max(min,column.size),0)>target){const column=columns.find(column=>column.size>min);column.delete([...column].pop());}
    columns.forEach(column=>{while(column.size<min)addDigit(column);});
    while(rules.total(values())<target){const pool=columns.filter(column=>column.size<max);addDigit(pool[Math.floor(Math.random()*pool.length)]);}
    update();
    window.portalDemo.recordGeneratedGame({game:'super',columns:values(),repeats:Number(repeats.value)});
  });
  byId('super-surprise').addEventListener('click',()=>{columns.forEach(column=>column.clear());byId('super-random').click();});
  byId('super-clear').addEventListener('click',()=>{columns.forEach(column=>column.clear());update();});
  byId('super-add').addEventListener('click',()=>{
    if(byId('super-add').disabled)return;
    const result=window.portalDemo.addSuperGame(values(),Number(repeats.value));
    if(!result.ok){update(result.message);return;}
    columns.forEach(column=>column.clear());update('Combinação adicionada ao carrinho de demonstração.');
  });
  byId('super-view-cart').addEventListener('click',()=>window.portalDemo.openCart());
  function updateCart() {
    const cart = window.portalDemo.getGames();
    byId('super-cart-count').textContent = cart.length;
    const preview = byId('super-cart-preview');
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
    byId('super-cart-total').textContent = formatMoney(total);
  }

  function route(){
    const active=location.hash==='#super-sete';document.body.classList.toggle('super-route',active);byId('super-view').hidden=!active;document.querySelector('[data-nav-game="super"]').classList.toggle('active',active);
    if(!active)return;
    document.body.classList.add('mega-route');['modalidades','combos','baixar-aplicativo'].forEach(id=>{byId(id).hidden=true;});
    document.querySelectorAll('.campaign-menu .active').forEach(item=>item.classList.remove('active'));document.querySelector('[data-nav-game="super"]').classList.add('active');
    document.querySelector('.hero-copy h1').textContent='Super Sete';document.querySelector('.hero-copy p').textContent='Aposte no Super Sete e concorra a prêmios em três sorteios semanais.';document.querySelector('.campaign-tickets img').setAttribute('src','assets/super-sete-ticket.png');
    document.title = 'Portal da Sorte | Demonstração';window.scrollTo({top:0,behavior:'instant'});window.dispatchEvent(new Event('scroll'));byId('super-title').focus({preventScroll:true});updateCart();
  }
  window.addEventListener('portal:cart-change',updateCart);window.addEventListener('hashchange',route);update();updateCart();route();
})();
