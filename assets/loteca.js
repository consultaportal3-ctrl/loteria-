(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const rules = window.lotecaRules;
  const picks = Array(14).fill(0);
  const formatMoney = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
  const table = byId('loteca-matches');
  window.lotecaData.matches.forEach((match,index) => {
    const row = document.createElement('tr');
    const cell = text => {const td=document.createElement('td');td.textContent=text;row.append(td);return td;};
    cell(String(index+1).padStart(2,'0'));
    cell(match.home).className='loteca-club';
    [1,2,4].forEach((bit,column) => {
      const td=cell('');
      const button=document.createElement('button');
      button.type='button';button.className='loteca-pick';
      button.dataset.match=index;button.dataset.outcome=bit;
      button.textContent=['1','X','2'][column];
      button.setAttribute('aria-label',`Jogo ${index+1}: ${[match.home+' vence','Empate',match.away+' vence'][column]}`);
      button.setAttribute('aria-pressed','false');td.append(button);
    });
    cell(match.away).className='loteca-club';
    cell(match.date.slice(0,5)).className='loteca-date';
    table.append(row);
  });
  function update(message) {
    const stats=rules.summary(picks);
    table.querySelectorAll('[data-outcome]').forEach(button=>button.setAttribute('aria-pressed',String(Boolean(picks[Number(button.dataset.match)] & Number(button.dataset.outcome)))));
    byId('loteca-counter').textContent=`${stats.filled} de 14 jogos preenchidos`;
    byId('loteca-doubles').textContent=stats.doubles;
    byId('loteca-triples').textContent=stats.triples;
    byId('loteca-combinations').textContent=stats.filled ? stats.combinations : 0;
    byId('loteca-total').textContent=formatMoney(Math.max(4,rules.price(picks)));
    byId('loteca-add').disabled=!rules.valid(picks,window.lotecaData.contest);
    byId('loteca-message').textContent=message || (stats.filled<14 ? `Preencha os ${14-stats.filled} jogos restantes.` : stats.combinations<2 ? 'Inclua pelo menos um duplo ou triplo para completar a aposta.' : 'Palpites completos. Você pode adicionar ao carrinho.');
  }
  table.addEventListener('click',event=>{
    const button=event.target.closest('[data-outcome]');if(!button)return;
    const index=Number(button.dataset.match);const bit=Number(button.dataset.outcome);
    const next=[...picks];next[index]^=bit;
    if(!rules.withinLimit(next)){update('Esta marcação ultrapassa o limite de duplos e triplos. Desmarque outro resultado para continuar.');return;}
    picks[index]=next[index];update();
  });
  byId('loteca-random').addEventListener('click',()=>{
    picks.forEach((mask,index)=>{if(!mask)picks[index]=[1,2,4][Math.floor(Math.random()*3)];});
    if(rules.summary(picks).combinations===1){
      const index=Math.floor(Math.random()*14);
      picks[index]|=[1,2,4].find(bit=>!(picks[index]&bit));
    }
    update();
    window.portalDemo.recordGeneratedGame({game:'loteca',picks:[...picks],contest:window.lotecaData.contest,repeats:1});
  });
  byId('loteca-surprise').addEventListener('click',()=>{picks.fill(0);byId('loteca-random').click();});
  byId('loteca-clear').addEventListener('click',()=>{picks.fill(0);update();});
  byId('loteca-add').addEventListener('click',()=>{
    const result=window.portalDemo.addLotecaGame(picks);
    if(!result.ok){update(result.message);return;}
    picks.fill(0);update('Palpites adicionados ao carrinho de demonstração.');
  });
  byId('loteca-view-cart').addEventListener('click',()=>window.portalDemo.openCart());
  function updateCart(){
    const preview=byId('loteca-cart-preview');preview.replaceChildren();
    const cart=window.portalDemo.getGames();
    byId('loteca-cart-count').textContent=cart.length;
    byId('loteca-cart-total').textContent=formatMoney(cart.reduce((sum,item)=>sum+item.referencePrice,0));
    if(!cart.length){const empty=document.createElement('p');empty.textContent='Seu carrinho está vazio.';preview.append(empty);}
    cart.forEach((item,index)=>{
      if(index<cart.length-6)return;
      const article=document.createElement('article');article.className='mega-recent-game';
      const classes={facil:'recent-facil',quina:'recent-quina',milionaria:'recent-milionaria',mania:'recent-mania',timemania:'recent-timemania',dupla:'recent-dupla',loteca:'recent-loteca'};
      if(classes[item.game])article.classList.add(classes[item.game]);
      if(item.game==='dia')article.classList.add('recent-dia');
      if(item.game==='super')article.classList.add('recent-super');
      const header=document.createElement('div');header.className='mega-recent-header';
      const title=document.createElement('strong');title.textContent=item.name.toLowerCase();
      const remove=document.createElement('button');remove.type='button';remove.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 9v9M14 9v9"/></svg>';remove.setAttribute('aria-label',`Remover jogo ${index+1}: ${item.name}`);remove.addEventListener('click',()=>window.portalDemo.removeGame(index));header.append(title,remove);
      const label=document.createElement('p');label.textContent=item.picks?'Palpites selecionados':'Números selecionados';
      const line=document.createElement('div');line.className='mega-recent-numbers';
      if(item.columns)window.superSeteRules.renderColumns(line,item.columns);
      else (item.picks?rules.labels(item.picks):item.numbers.map(n=>String(n).padStart(2,'0'))).forEach(text=>{const span=document.createElement('span');span.textContent=text;line.append(span);});
      article.append(header,label,line);
      if(item.team||item.trevos){const extra=document.createElement('p');extra.textContent=item.team?`Time do Coração: ${item.team}`:`Trevos: ${item.trevos.join(' · ')}`;article.append(extra);}
      if(item.game==='dia' && Number.isInteger(item.month)){const monthDetails=document.createElement('p');monthDetails.className='recent-dia-month';monthDetails.setAttribute('aria-label',`Mês da Sorte: ${window.portalMonths[item.month]}`);monthDetails.textContent=window.portalMonths[item.month].toLocaleUpperCase('pt-BR');article.append(monthDetails);}
      const details=document.createElement('p');const first=item.contest||{mega:3086,facil:3829,quina:7167,milionaria:407,mania:2999,timemania:2468,dupla:3032,dia:1347,super:922}[item.game];
      if(first){const contest=document.createElement('span');contest.textContent=`Concurso: ${first}${item.repeats>1?' a '+(first+item.repeats-1):''}`;details.append(contest,document.createElement('br'));}
      details.append(`Valor: ${formatMoney(item.referencePrice)}`);article.append(details);preview.prepend(article);
    });
  }
  function route(){
    const active=location.hash==='#loteca';document.body.classList.toggle('loteca-route',active);byId('loteca-view').hidden=!active;
    document.querySelector('[data-nav-game="loteca"]').classList.toggle('active',active);
    if(!active)return;
    document.body.classList.add('mega-route');
    ['modalidades','combos','baixar-aplicativo'].forEach(id=>{byId(id).hidden=true;});
    document.querySelectorAll('.campaign-menu .active').forEach(item=>item.classList.remove('active'));
    document.querySelector('[data-nav-game="loteca"]').classList.add('active');
    document.querySelector('.hero-copy h1').textContent='Loteca';
    document.querySelector('.hero-copy p').textContent='Você pode se tornar um campeão apostando na sua paixão pelo futebol!';
    document.querySelector('.campaign-tickets img').setAttribute('src','assets/loteca-ticket.png');
    document.title = 'Loterias Online Caixa';window.scrollTo({top:0,behavior:'instant'});window.dispatchEvent(new Event('scroll'));byId('loteca-title').focus({preventScroll:true});updateCart();
  }
  window.addEventListener('portal:cart-change',updateCart);window.addEventListener('hashchange',route);
  update();updateCart();route();
})();
