// Shared privacy widget, matching the landing page.
(() => {
document.body.insertAdjacentHTML("beforeend", "<style>\n.cookie-notice{position:fixed;left:12px;bottom:12px;z-index:1000;width:438px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto;padding:28px 26px 24px;border-radius:26px;background:#f8fafb;color:#3d4c60;box-shadow:0 8px 28px #0003;font:15px/1.7 Arial,sans-serif}.cookie-notice[hidden],.cookie-settings-link[hidden]{display:none}.cookie-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px;color:#0064b9}.cookie-heading h2{margin:0;font:bold 16px/1.5 Arial,sans-serif}.cookie-heading span{font-size:14px}.cookie-notice p{margin:0 0 6px}.cookie-description{padding:10px;border:1px solid #9ba7b5;border-radius:4px;font-style:italic}.cookie-links{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0 28px;color:#0064b9}.cookie-link{padding:0;border:0;background:none;color:inherit;font:inherit;font-weight:700;text-decoration:underline;cursor:pointer}.cookie-actions{display:flex;align-items:center;justify-content:space-between;gap:16px}.cookie-actions button{font:700 14px Arial,sans-serif}.cookie-choice{min-height:48px;padding:12px 30px;border:1px solid #3d4c60;border-radius:28px;background:transparent;color:#3d4c60}.cookie-accept{border-color:#0064b9;background:#0064b9;color:#fff;box-shadow:0 10px 20px #0064b922}.cookie-choice:hover{filter:brightness(.94)}.cookie-settings-link{position:fixed;bottom:12px;left:12px;z-index:999;padding:8px 14px;border:1px solid #ccd3da;border-radius:20px;background:#f8fafb;color:#0064b9;font:14px Arial,sans-serif;box-shadow:0 2px 8px #0002}#cookie-preferences{color:#3d4c60;font-family:Arial,sans-serif}#cookie-preferences h2{color:#0064b9;font-size:21px}#cookie-preferences p{font-size:15px}#cookie-preferences label{display:flex;gap:12px;align-items:center;margin:18px 0;font-size:15px}#cookie-preferences input{width:18px;height:18px;accent-color:#0064b9}#cookie-preferences .cookie-actions{flex-wrap:wrap;justify-content:flex-end}#cookie-preferences .cookie-choice{font:700 14px Arial,sans-serif}#cookie-preferences .cookie-policy{padding-top:14px;border-top:1px solid #ccd3da}#cookie-preferences .cookie-policy h3{font-size:17px}@media(max-width:460px){.cookie-notice{padding:24px 20px}.cookie-actions{gap:12px}.cookie-choice{padding:12px 22px}.cookie-links{margin-bottom:26px}}@media(max-width:350px){.cookie-actions{flex-wrap:wrap}.cookie-actions>.cookie-link{width:100%;text-align:left}.cookie-choice{flex:1}}\n  </style>  <section class=\"cookie-notice\" id=\"cookie-notice\" role=\"region\" aria-labelledby=\"cookie-title\" hidden>\n    <div class=\"cookie-heading\"><h2 id=\"cookie-title\" tabindex=\"-1\">Aviso de privacidade</h2><span>Cookies</span></div>\n    <p>Nosso site usa cookies para melhorar a navegação.</p>\n    <p class=\"cookie-description\">Você pode escolher se permite cookies de análise, publicidade e personalização de anúncios.</p>\n    <div class=\"cookie-links\">\n      <button type=\"button\" class=\"cookie-link\" data-cookie-details=\"privacy\">Aviso de Privacidade</button>\n      <span aria-hidden=\"true\">-</span>\n      <button type=\"button\" class=\"cookie-link\" data-cookie-details=\"cookies\">Aviso sobre cookies</button>\n    </div>\n    <div class=\"cookie-actions\">\n      <button type=\"button\" class=\"cookie-link\" data-cookie-details=\"options\">Opções</button>\n      <button type=\"button\" class=\"cookie-choice\" id=\"cookie-reject\">Rejeitar</button>\n      <button type=\"button\" class=\"cookie-choice cookie-accept\" id=\"cookie-accept\">Aceitar</button>\n    </div>\n  </section>\n  <style>\n    .cookie-settings-link{display:grid;place-items:center;width:58px;height:58px;padding:0;border:0;border-radius:50%;background:#80b1d5;box-shadow:0 2px 9px #0004;transition:transform .15s,box-shadow .15s}\n    .cookie-settings-link:hover{transform:scale(1.05);box-shadow:0 3px 12px #0005}\n    .cookie-settings-link svg{display:block;width:48px;height:48px;pointer-events:none}\n    @media(prefers-reduced-motion:reduce){.cookie-settings-link{transition:none}}\n  </style>\n  <button type=\"button\" class=\"cookie-settings-link\" id=\"cookie-settings-link\" aria-label=\"Preferências de cookies\" title=\"Preferências de cookies\" hidden>\n    <svg viewBox=\"0 0 48 48\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\">\n      <path d=\"M30 7a7 7 0 0 0 8 9 6 6 0 0 0 5 7c1 11-7 19-18 19C14 42 6 34 6 24S14 6 24 6c2 0 4 .3 6 1Z\" fill=\"#fff\"/>\n      <g fill=\"#80b1d5\">\n        <circle cx=\"21\" cy=\"15\" r=\"2.1\"/>\n        <circle cx=\"14\" cy=\"25\" r=\"2\"/>\n        <circle cx=\"25\" cy=\"24\" r=\"2.3\"/>\n        <circle cx=\"33\" cy=\"28\" r=\"1.8\"/>\n        <circle cx=\"22\" cy=\"34\" r=\"2\"/>\n        <circle cx=\"30\" cy=\"36\" r=\"1.4\"/>\n      </g>\n    </svg>\n  </button>\n  <dialog id=\"cookie-preferences\" aria-labelledby=\"cookie-preferences-title\">\n    <h2 id=\"cookie-preferences-title\">Preferências de cookies</h2>\n    <p>Escolha quais categorias deseja permitir. Você pode alterar sua escolha a qualquer momento em “Preferências de cookies”.</p>\n    <label><input type=\"checkbox\" checked disabled> Necessários — sempre ativos</label>\n    <label><input type=\"checkbox\" id=\"cookie-analytics\"> Análise de navegação</label>\n    <label><input type=\"checkbox\" id=\"cookie-advertising\"> Publicidade e personalização</label>\n    <section class=\"cookie-policy\" id=\"cookie-privacy-policy\">\n      <h3>Aviso de Privacidade</h3>\n      <p>Esta página guarda sua escolha de privacidade apenas neste navegador. Este aviso não envia dados pessoais a terceiros nem instala ferramentas de análise ou publicidade.</p>\n    </section>\n    <section class=\"cookie-policy\" id=\"cookie-policy\">\n      <h3>Aviso sobre cookies</h3>\n      <p>A preferência é salva no armazenamento local do navegador para lembrar sua decisão nas próximas visitas. Rejeitar mantém as categorias opcionais desativadas.</p>\n    </section>\n    <div class=\"cookie-actions\">\n      <button type=\"button\" class=\"cookie-choice\" id=\"cookie-close\">Fechar</button>\n      <button type=\"button\" class=\"cookie-choice cookie-accept\" id=\"cookie-save\">Salvar preferências</button>\n    </div>\n  </dialog>\n");
(() => {
      const storageKey = 'site-cookie-consent-v1';
      const notice = document.getElementById('cookie-notice');
      const reopen = document.getElementById('cookie-settings-link');
      const preferences = document.getElementById('cookie-preferences');
      const analytics = document.getElementById('cookie-analytics');
      const advertising = document.getElementById('cookie-advertising');
      let consent = null;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved && saved.necessary === true && typeof saved.analytics === 'boolean' && typeof saved.advertising === 'boolean') consent = saved;
      } catch (_) { /* Keep the notice usable when browser storage is unavailable. */ }
      notice.hidden = !!consent;
      reopen.hidden = !consent;
      function saveConsent(allowAnalytics, allowAdvertising) {
        consent = { necessary: true, analytics: allowAnalytics, advertising: allowAdvertising, updatedAt: new Date().toISOString() };
        try { localStorage.setItem(storageKey, JSON.stringify(consent)); } catch (_) {}
        if (preferences.open) preferences.close();
        notice.hidden = true;
        reopen.hidden = false;
        reopen.focus({ preventScroll: true });
        window.dispatchEvent(new CustomEvent('cookie-consent-change', { detail: { ...consent } }));
      }
      function openPreferences(section) {
        analytics.checked = !!consent?.analytics;
        advertising.checked = !!consent?.advertising;
        preferences.showModal();
        preferences.scrollTop = 0;
        const target = section === 'privacy' ? document.getElementById('cookie-privacy-policy') : section === 'cookies' ? document.getElementById('cookie-policy') : null;
        if (target) target.scrollIntoView({ block: 'nearest' });
      }
      document.getElementById('cookie-accept').addEventListener('click', () => saveConsent(true, true));
      document.getElementById('cookie-reject').addEventListener('click', () => saveConsent(false, false));
      document.getElementById('cookie-save').addEventListener('click', () => saveConsent(analytics.checked, advertising.checked));
      document.getElementById('cookie-close').addEventListener('click', () => preferences.close());
      document.querySelectorAll('[data-cookie-details]').forEach(button => button.addEventListener('click', () => openPreferences(button.dataset.cookieDetails)));
      reopen.addEventListener('click', () => {
        notice.hidden = false;
        reopen.hidden = true;
        document.getElementById('cookie-title').focus({ preventScroll: true });
      });
    })();
})();
