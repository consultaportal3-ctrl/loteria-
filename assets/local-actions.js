(() => {
  'use strict';
  const dialog = document.createElement('dialog');
  dialog.id = 'local-info-dialog';
  dialog.className = 'game-dialog';
  dialog.setAttribute('aria-labelledby', 'local-info-title');
  dialog.innerHTML = '<div class="dialog-top"><span class="eyebrow blue">INFORMAÇÕES</span><button class="icon-button" type="button" aria-label="Fechar informações">×</button></div><h2 id="local-info-title"></h2><p id="local-info-description"></p><p class="hint">Demonstração independente. Não recebe pagamentos nem registra apostas.</p><button class="button" type="button">Voltar</button>';
  document.body.append(dialog);
  dialog.querySelectorAll('button').forEach(button => button.addEventListener('click', () => dialog.close()));
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-local-info]');
    if (!trigger) return;
    event.preventDefault();
    const card = trigger.closest('.combo-card,.product-card');
    const title = card?.querySelector('h3')?.textContent || trigger.textContent.trim();
    let description = 'Esta modalidade ainda não possui um volante nesta demonstração. Você pode escolher 6 de 60 ou 15 de 25 pelo menu para montar suas combinações.';
    if (card?.classList.contains('combo-card')) {
      description = `${card.querySelector('.combo-content p').textContent} Valor de referência: ${card.querySelector('.combo-price').textContent}. A montagem deste pacote ainda não está disponível.`;
    } else if (trigger.classList.contains('account-link')) {
      description = 'Este site não possui cadastro ou acesso a contas. Suas combinações ficam salvas somente neste navegador e podem ser consultadas no carrinho.';
    } else if (trigger.classList.contains('mega-results')) {
      description = 'O histórico de resultados ainda não está disponível nesta demonstração.';
    } else if (title === 'Dúvidas') {
      description = 'Escolha uma modalidade, marque seus números ou use a Surpresinha e adicione a combinação ao carrinho. Você pode revisar e remover jogos antes de concluir a simulação.';
    }
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('#local-info-description').textContent = description;
    dialog.showModal();
  });
})();
