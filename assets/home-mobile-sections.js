(() => {
  const track = document.getElementById('game-cards');
  if (!track) return;
  const media = matchMedia('(max-width:650px)');
  const subtitle = document.querySelector('.combos-subtitle');
  const originalSubtitle = subtitle?.textContent;
  const carousel = document.createElement('div');
  carousel.className = 'phone-products-carousel';
  track.before(carousel);
  carousel.append(track);
  const arrow = (direction, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `phone-product-arrow phone-product-${direction}`;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-controls', 'game-cards');
    button.innerHTML = `<svg viewBox="0 0 24 34" aria-hidden="true"><path d="${direction === 'prev' ? 'M18 5 6 17l12 12' : 'm6 5 12 12L6 29'}" fill="none" stroke="currentColor" stroke-width="6"/></svg>`;
    carousel.append(button);
    button.addEventListener('click', () => track.scrollBy({left: (direction === 'prev' ? -1 : 1) * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'}));
    return button;
  };
  const previous = arrow('prev', 'Produto anterior');
  const next = arrow('next', 'Próximo produto');
  const position = document.createElement('p');
  position.className = 'phone-product-position';
  position.setAttribute('role', 'status');
  position.setAttribute('aria-live', 'polite');
  carousel.append(position);
  function sync() {
    if (subtitle) subtitle.textContent = media.matches ? 'Cada combo possui uma variedade de jogos prontos para você testar a sua sorte. Quanto mais você joga, mais chances de ganhar!' : originalSubtitle;
    previous.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    const cards = [...track.querySelectorAll('.product-card')];
    const bounds = track.getBoundingClientRect();
    const center = bounds.left + bounds.width / 2;
    let active = 0;
    cards.forEach((card,index) => {
      const rect = card.getBoundingClientRect();
      const current = cards[active]?.getBoundingClientRect();
      if (current && Math.abs(rect.left + rect.width/2 - center) < Math.abs(current.left + current.width/2 - center)) active = index;
    });
    position.textContent = cards.length ? `Produto ${active + 1} de ${cards.length}` : 'Nenhum produto encontrado';
    cards.forEach((card,index) => {
      card.inert = media.matches && index !== active;
    });
  }
  track.addEventListener('scroll', sync, {passive:true});
  new MutationObserver(sync).observe(track, {childList:true});
  window.addEventListener('resize', sync);
  media.addEventListener('change', sync);
  sync();
})();
