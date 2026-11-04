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
  function sync() {
    if (subtitle) subtitle.textContent = media.matches ? 'Cada combo possui uma variedade de jogos prontos para você testar a sua sorte. Quanto mais você joga, mais chances de ganhar!' : originalSubtitle;
    previous.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    track.querySelectorAll('.product-card').forEach(card => {
      card.inert = media.matches && Math.abs(card.offsetLeft - track.offsetLeft - track.scrollLeft) > track.clientWidth / 2;
    });
  }
  track.addEventListener('scroll', sync, {passive:true});
  new MutationObserver(sync).observe(track, {childList:true});
  window.addEventListener('resize', sync);
  media.addEventListener('change', sync);
  sync();
})();
