(() => {
  'use strict';
  const key = 'portal-pool-demo-cart-v1';
  const items = document.getElementById('items');
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value / 100);
  function render() {
    let cart; try { cart = JSON.parse(localStorage.getItem(key) || '[]'); if (!Array.isArray(cart)) cart = []; } catch (_) { cart = []; }
    items.replaceChildren();
    if (!cart.length) items.textContent = 'Seu carrinho de demonstra\u00e7\u00e3o est\u00e1 vazio.';
    cart.forEach((item, index) => {
      const row = document.createElement('div'); row.className = 'item';
      const title = document.createElement('strong'); title.textContent = 'Mega da Virada — ' + item.description;
      const info = document.createElement('p'); info.textContent = item.quantity + ' cota(s) × ' + money(item.price) + ' = ' + money(item.quantity * item.price);
      const remove = document.createElement('button'); remove.className = 'remove'; remove.textContent = 'Remover'; remove.addEventListener('click', () => { cart.splice(index, 1); localStorage.setItem(key, JSON.stringify(cart)); render(); });
      row.append(title, info, remove); items.append(row);
    });
    document.getElementById('total').textContent = 'Total simulado: ' + money(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
  }
  document.getElementById('clear').addEventListener('click', () => { localStorage.removeItem(key); render(); });
  render();
})();
