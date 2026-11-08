(() => {
  const toggle = document.getElementById('phone-menu-toggle');
  const menu = document.getElementById('phone-navigation-menu');
  const navigation = toggle.closest('.campaign-navigation');
  const phone = matchMedia('(max-width:650px)');
  function updateRouteLayout() {
    requestAnimationFrame(() => {
      const isGame = [...document.body.classList].some(name => name.endsWith('-route') && name !== 'cart-route');
      const subtitle = document.querySelector('.hero-copy p');
      const lineHeight = parseFloat(getComputedStyle(subtitle).lineHeight);
      document.body.classList.toggle('phone-multiline-description', phone.matches && isGame && subtitle.getBoundingClientRect().height > lineHeight * 1.5);
    });
  }
  function setOpen(open, focus = false) {
    const expanded = phone.matches && open;
    navigation.classList.toggle('is-open', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    menu.inert = phone.matches && !expanded;
    if (phone.matches) menu.setAttribute('aria-hidden', String(!expanded));
    else menu.removeAttribute('aria-hidden');
    if (focus) toggle.focus({preventScroll:true});
  }
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', event => {
    if (event.target.closest('a,button')) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.classList.contains('is-open')) setOpen(false,true);
  });
  window.addEventListener('hashchange', () => { setOpen(false); updateRouteLayout(); });
  window.addEventListener('resize', updateRouteLayout);
  phone.addEventListener('change', () => { setOpen(false); updateRouteLayout(); });
  document.fonts.ready.then(updateRouteLayout);
  setOpen(false);
  updateRouteLayout();
})();
