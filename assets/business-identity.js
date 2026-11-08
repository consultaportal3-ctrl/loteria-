(() => {
  'use strict';
  const identity = document.querySelector('[data-business-identity]');
  if (!identity) return;

  async function loadIdentity() {
    try {
      const response = await fetch(new URL('api/checkout-info', location.href), {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      let business;
      try {
        business = await response.json();
      } catch {
        throw new Error('O servidor não respondeu como uma API válida.');
      }
      if (!response.ok) throw new Error(business.error || 'Os dados do operador não estão configurados.');
      if (business.simulation === true) {
        identity.textContent = business.notice;
        return;
      }
      identity.replaceChildren(document.createTextNode(
        `${business.publicName} · ${business.legalName} (CNPJ ${business.taxId}) · ${business.address} · ${business.contactEmail} · `,
      ));
      for (const [label, url] of [['Privacidade', business.privacyUrl], ['Termos', business.termsUrl]]) {
        const link = document.createElement('a');
        link.href = url;
        link.textContent = label;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        identity.append(link, document.createTextNode(' '));
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível carregar os dados do operador.';
      identity.textContent = `${message} Checkout desativado.`;
    }
  }

  loadIdentity();
})();
