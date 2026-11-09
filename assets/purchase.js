(() => {
  'use strict';
  const select=document.getElementById('purchase-game');
  const choice=document.getElementById('purchase-choice');
  const back=document.getElementById('purchase-back');
  const routes={mega:'mega-sena',facil:'lotofacil',quina:'quina',milionaria:'mais-milionaria',dupla:'dupla-sena',timemania:'timemania',dia:'dia-de-sorte',super:'super-sete'};
  const requested=new URLSearchParams(location.search).get('modalidade');
  select.value=Object.hasOwn(routes,requested)?requested:'';
  function update(){
    choice.textContent=select.selectedOptions[0].textContent;
    back.href=`../home.html#${routes[select.value]||'modalidades'}`;
    document.title='Loterias Online Caixa';
  }
  select.addEventListener('change',update);
  update();
})();
