(() => {
  'use strict';
  const colors = {
    mega: ['#00a94f', '#fff'], facil: ['#92278f', '#fff'],
    quina: ['#32318e', '#fff'], milionaria: ['#2b327d', '#fff'],
    dupla: ['#af2942', '#fff'], mania: ['#ed7900', '#fff'],
    dia: ['#e8c41e', '#8b760a'], super: ['#bddb29', '#00863d'],
    timemania: ['#fff200', '#00863d']
  };
  const tile = (id, name, contest) => ({ id, name, contest });
  const combos = [
    {
      name: 'Fezinha do Mês', price: '426,00',
      description: 'Quer sorte o mês inteiro? Pacote de apostas teimosinhas de todas as modalidades disponíveis, exceto Números e time e Palpites de futebol.',
      tiles: [tile('mega','6 de 60','3081 a 3092'),tile('facil','15 de 25','3821 a 3844'),tile('quina','5 de 80','7159 a 7170'),tile('milionaria','6 + 2 extras','404 a 408'),tile('dupla','Duplo 6 de 50','3028 a 3039'),tile('mania','50 de 100','2995 a 3006'),tile('dia','Números e mês','1339 a 1362'),tile('super','Sete colunas','918 a 929')]
    },
    {
      name: 'Loterias Pra Elas', price: '21,00',
      description: 'Pacote com as modalidades preferidas pelas apostadoras. Várias chances para realizar seus sonhos. Já Pensou?',
      tiles: [tile('mega','6 de 60','3081'),tile('facil','15 de 25','3821'),tile('milionaria','6 + 2 extras','404'),tile('dupla','Duplo 6 de 50','3028'),tile('dia','Números e mês','1339')]
    },
    {
      name: 'Chance Todo Dia', price: '148,50',
      description: 'Com este pacote você garante suas apostas para todas as modalidades, incluindo teimosinhas para a semana inteira. Já Pensou?',
      tiles: [tile('mega','6 de 60','3075 a 3080'),tile('facil','15 de 25','3814 a 3819'),tile('quina','5 de 80','7152 a 7157'),tile('milionaria','6 + 2 extras','402 a 403'),tile('dupla','Duplo 6 de 50','3025 a 3027'),tile('mania','50 de 100','2992 a 2994'),tile('timemania','Números e time','2460 a 2462'),tile('dia','Números e mês','1332 a 1337'),tile('super','Sete colunas','915 a 917')]
    },
    {
      name: 'Milionário', price: '50,00',
      description: 'Para quem quer ficar mais que milionário: pacote para concursos com prêmios acima de R$ 1,5 milhão, incluindo o concurso especial vigente.',
      tiles: [tile('mega','6 de 60','3075'),tile('facil','15 de 25','3814'),tile('milionaria','6 + 2 extras','402'),tile('dupla','Duplo 6 de 50','3025'),tile('timemania','Números e time','2460'),tile('super','Sete colunas','915')]
    },
    {
      name: 'Sorte Fácil', price: '61,00',
      description: 'Com este pacote você aposta nas modalidades com maior chance de acerto: 15 de 25, Números e mês, Sete colunas e 50 de 100.',
      tiles: [tile('facil','15 de 25','3814'),tile('mania','50 de 100','2992'),tile('dia','Números e mês','1332'),tile('super','Sete colunas','915')]
    },
    {
      name: 'Combo Vip', price: '1.652,00',
      description: 'Aumente suas chances com este pacote exclusivo de apostas múltiplas e concorra aos prêmios das modalidades mais amadas do Brasil!',
      tiles: [tile('mega','6 de 60','3075'),tile('facil','15 de 25','3814'),tile('quina','5 de 80','7152'),tile('milionaria','6 + 2 extras','402')]
    }
  ];
  combos.push({name:'Especial',price:'24,00',description:'Aposte no combo exclusivo do concurso especial da Especial anual e aumente suas chances! O prêmio é estimado em R$ 1 bilhão e não acumula. Já pensou?',tiles:[tile('virada','Especial anual','3100')]});
  colors.virada=['#00a94f','#fff'];
  const carouselCombos=()=>[combos[6],...combos.slice(0,6)];
  const track = document.getElementById('combo-track');
  const previous = document.getElementById('combo-prev');
  const next = document.getElementById('combo-next');
  let activeIndex = 0;
  const getVisibleCount = () => window.innerWidth <= 720 ? 1 : window.innerWidth <= 1100 ? 2 : 3;
  let visibleCount = getVisibleCount();
  let monthlyQuantity=1;
  let monthlySlide=5;
  let monthlyOpen=false;
  let monthlyPreview=false;
  let monthlyTimer;
  let selectedComboIndex=0;
  const activePanel=()=>track.querySelector(`[data-combo-index="${selectedComboIndex}"] .combo-options`);
  const selectedBetCount=()=>[9,5,10,12,20,4,4][selectedComboIndex];
  const selectedPrice=()=>[426,21,148.5,50,61,1652,24][selectedComboIndex];
  const tileGameCount=item=>selectedComboIndex===6?4:selectedComboIndex===4?{facil:8,mania:2,dia:6,super:4}[item.id]:selectedComboIndex===3||item.id==='mania'&&selectedComboIndex!==1?2:1;
  const maxComboQuantity=()=>Math.floor(30/selectedBetCount());
  function stopMonthlyRotation(){clearInterval(monthlyTimer);}
  function advanceMonthlySlide(step){
    monthlySlide=(monthlySlide+step+combos[selectedComboIndex].tiles.length)%combos[selectedComboIndex].tiles.length;
    updateMonthlyPanel();
    const slides=activePanel()?.querySelector('.combo-options-games');
    if(slides&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)slides.animate([{opacity:.4,transform:'translateX(6px)'},{opacity:1,transform:'translateX(0)'}],{duration:220});
  }
  function startMonthlyRotation(){
    stopMonthlyRotation();
    monthlyTimer=setInterval(()=>{
      const panel=activePanel();
      if(monthlyOpen&&!document.hidden&&panel?.getClientRects().length)advanceMonthlySlide(1);
    },4000);
  }
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
  function monthlyPanel(combo){
    return `<section class="combo-options" aria-label="Monte ${combo.name}" hidden><button type="button" class="combo-options-close" data-combo-close aria-label="Fechar opções"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 5 14 14M19 5 5 19"/></svg></button><div class="combo-options-top"><div class="combo-options-carousel"><button type="button" data-combo-slide="-1" aria-label="Modalidades anteriores">‹</button><div class="combo-options-games"></div><button type="button" data-combo-slide="1" aria-label="Próximas modalidades">›</button></div><p>Os números dos jogos dos combos são escolhidos aleatoriamente pelo sistema. Mas antes de efetuar o pagamento é possível visualizar os números selecionados.</p><label class="combo-preview-choice"><input type="checkbox" data-combo-preview> Quero ver os números escolhidos antes de pagar</label></div><div class="combo-options-bottom"><p>Quantidade de apostas:</p><div class="combo-quantity"><button type="button" data-combo-quantity="-1" aria-label="Diminuir quantidade de apostas">−</button><output aria-live="polite">${[9,5,10,12,20,4,4][combos.indexOf(combo)]}</output><button type="button" data-combo-quantity="1" aria-label="Aumentar quantidade de apostas">+</button></div><strong class="combo-options-total" aria-live="polite">Total: R$ ${combo.price}</strong><div class="combo-options-actions"><button type="button" data-combo-add="pay">Pagar agora</button><button type="button" data-combo-add="cart">Incluir no carrinho</button></div><span class="combo-options-status" role="status"></span></div></section>`;
  }
  function updateMonthlyPanel(){
    const panel=activePanel();if(!panel)return;
    panel.querySelector('.combo-options-games').innerHTML=Array.from({length:Math.min(3,combos[selectedComboIndex].tiles.length)},(_,offset)=>combos[selectedComboIndex].tiles[(monthlySlide+offset)%combos[selectedComboIndex].tiles.length]).map(item=>`<div><span>${tileGameCount(item)} ${tileGameCount(item)===1?'jogo':'jogos'}</span><b>${item.name}</b><span>Concurso ${item.contest}</span></div>`).join('');
    panel.querySelector('output').textContent=monthlyQuantity*selectedBetCount();
    panel.querySelector('[data-combo-preview]').checked=monthlyPreview;
    panel.querySelector('.combo-options-total').textContent=`Total: ${money(monthlyQuantity*selectedPrice())}`;
    panel.querySelector('[data-combo-quantity="-1"]').disabled=monthlyQuantity===1;
    panel.querySelector('[data-combo-quantity="1"]').disabled=monthlyQuantity===maxComboQuantity();
  }
  function render(announce = false) {
    track.innerHTML = carouselCombos().slice(activeIndex, activeIndex + visibleCount).map(combo => {
      const tiles = combo.tiles.map(item => {
        const [background, color] = colors[item.id];
        return `<div class="combo-tile" style="--tile-background:${background};--tile-color:${color}"><span class="combo-watermark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>${item.name}${item.id === 'mania' ? ' <small>+ Espelho</small>' : ''}</b><span>Concurso ${item.contest}</span></div>`;
      }).join('');
      const buy=`<button class="combo-buy" type="button" data-combo-open="${combos.indexOf(combo)}" aria-label="Montar ${combo.name}">Aposte Já</button>`;
      return `<article class="combo-card${combo===combos[6]?' combo-special':''}" data-combo-index="${combos.indexOf(combo)}" aria-label="${combo.name}"><div class="combo-front"><div class="combo-mosaic" style="--combo-rows:${Math.ceil(combo.tiles.length / 2)}">${tiles}</div><div class="combo-content"><h3>${combo.name}</h3><p>${combo.description}</p><strong class="combo-price">R$ ${combo.price}</strong>${buy}</div></div>${monthlyPanel(combo)}</article>`;
    }).join('');
    const panel=activePanel();
    if(monthlyOpen&&panel){panel.hidden=false;panel.closest('.combo-card').querySelector('.combo-front').hidden=true;updateMonthlyPanel();}
    previous.disabled = activeIndex === 0;
    next.disabled = activeIndex >= carouselCombos().length - visibleCount;
    if (announce) document.getElementById('combo-status').textContent = `Combos ${activeIndex + 1} a ${Math.min(activeIndex + visibleCount, carouselCombos().length)} de ${carouselCombos().length}.`;
  }
  function change(direction) {
    const target = Math.max(0,Math.min(activeIndex + direction * visibleCount,carouselCombos().length-visibleCount));
    if (target === activeIndex) return;
    activeIndex = target;
    monthlyOpen=false;
    stopMonthlyRotation();
    render(true);
  }
  previous.addEventListener('click', () => change(-1));
  next.addEventListener('click', () => change(1));
  track.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const card=button.closest('.combo-card'),panel=card?.querySelector('.combo-options');
    if(button.hasAttribute('data-combo-open')){
      const previousPanel=activePanel();if(previousPanel){previousPanel.hidden=true;previousPanel.closest('.combo-card').querySelector('.combo-front').hidden=false;}selectedComboIndex=Number(button.dataset.comboOpen);monthlyOpen=true;monthlyPreview=false;monthlyQuantity=1;monthlySlide=selectedComboIndex===5?1:selectedComboIndex>=2?0:combos[selectedComboIndex].tiles.length-3;card.querySelector('.combo-front').hidden=true;panel.hidden=false;updateMonthlyPanel();panel.querySelector('[data-combo-close]').focus({preventScroll:true});
      startMonthlyRotation();
    }else if(button.hasAttribute('data-combo-close')){
      monthlyOpen=false;panel.hidden=true;card.querySelector('.combo-front').hidden=false;card.querySelector('[data-combo-open]').focus({preventScroll:true});
      stopMonthlyRotation();
    }else if(button.dataset.comboSlide){
      advanceMonthlySlide(Number(button.dataset.comboSlide)*3);startMonthlyRotation();
    }else if(button.dataset.comboQuantity){
      monthlyQuantity=Math.max(1,Math.min(maxComboQuantity(),monthlyQuantity+Number(button.dataset.comboQuantity)));updateMonthlyPanel();panel.querySelector('.combo-options-status').textContent='';
    }else if(button.dataset.comboAdd){
      const result=window.portalDemo.addComboPack(['monthly','elas','chance','milionario','sorte','vip','virada'][selectedComboIndex],monthlyQuantity);
      panel.querySelector('.combo-options-status').textContent=result.ok?`${result.count} apostas incluídas no carrinho.`:result.message;
      if(result.ok&&(button.dataset.comboAdd==='pay'||panel.querySelector('[data-combo-preview]').checked))window.portalDemo.openCart();
    }
  });
  track.addEventListener('change',event=>{if(event.target.matches('[data-combo-preview]'))monthlyPreview=event.target.checked;});
  track.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      change(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  let phoneSpecial = window.innerWidth<=650;
  window.addEventListener('resize', () => {
    if(phoneSpecial !== (window.innerWidth<=650)){phoneSpecial=window.innerWidth<=650;activeIndex=0;monthlyOpen=false;stopMonthlyRotation();visibleCount=getVisibleCount();render();return;}
    const count = getVisibleCount();
    if (count === visibleCount) return;
    visibleCount = count;
    const position = monthlyOpen ? carouselCombos().indexOf(combos[selectedComboIndex]) : activeIndex;
    activeIndex = Math.min(Math.floor(position / visibleCount) * visibleCount, carouselCombos().length - visibleCount);
    render();
  });
  render();
})();
