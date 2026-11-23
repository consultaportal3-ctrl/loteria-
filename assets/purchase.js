(() => {
  'use strict';
  const select = document.getElementById('purchase-game');
  const choice = document.getElementById('purchase-choice');
  const back = document.getElementById('purchase-back');
  const routes = {virada:'mega-virada', mega:'mega-sena', facil:'lotofacil', quina:'quina', milionaria:'mais-milionaria', dupla:'dupla-sena', timemania:'timemania', dia:'dia-de-sorte', super:'super-sete'};
  const requested = new URLSearchParams(location.search).get('modalidade');
  select.value = Object.hasOwn(routes, requested) ? requested : '';
  function update() {
    choice.textContent = select.value ? select.selectedOptions[0].textContent : 'Todas as modalidades';
    back.href = '../home.html#' + (routes[select.value] || 'modalidades');
    document.title = 'Bolões de ' + choice.textContent + ' | Portal da Sorte';
  }
  select.addEventListener('change', update);
  update();
})();
