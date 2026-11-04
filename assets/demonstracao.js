(() => {
  const field = document.getElementById('demo-alias');
  const error = document.getElementById('demo-error');
  const entry = document.getElementById('demo-entry');
  const complete = document.getElementById('demo-complete');
  document.getElementById('demo-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!field.value.trim() || /\d|@/.test(field.value)) {
      field.value = '';
      error.textContent = 'Use um nome inventado, somente com letras, como Jogador Azul.';
      error.hidden = false;
      field.setAttribute('aria-invalid', 'true');
      field.focus();
      return;
    }
    field.value = '';
    error.hidden = true;
    field.removeAttribute('aria-invalid');
    entry.hidden = true;
    complete.hidden = false;
    document.getElementById('demo-complete-title').focus();
  });
  document.getElementById('demo-restart').addEventListener('click', () => {
    complete.hidden = true;
    entry.hidden = false;
    field.focus();
  });
  document.querySelectorAll('[data-info]').forEach(button => button.addEventListener('click', () => {
    const info = document.getElementById('demo-info');
    info.textContent = button.dataset.info === 'signup' ? 'Cadastro indisponível neste protótipo. Você pode testar a interface com um nome fictício, sem criar conta.' : 'Digite um nome inventado, como Jogador Azul, e clique em Próximo. Não informe CPF, senha, e-mail ou dados reais.';
    info.hidden = false;
  }));
  window.addEventListener('pagehide', () => { field.value = ''; });
})();
