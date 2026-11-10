(() => {
  'use strict';
  const script = document.currentScript;
  const api = new URL('../api/visitors', script.src);
  let busy = false, lastSent = 0;
  async function heartbeat() {
    if (document.hidden || busy || Date.now() - lastSent < 25000) return;
    busy = true;
    lastSent = Date.now();
    try {
      await fetch(api, {method:'POST', credentials:'same-origin', cache:'no-store',
        headers:{'Content-Type':'application/json'}, body:JSON.stringify({page:location.pathname}),
        signal:AbortSignal.timeout(8000)});
    } catch (_) { /* Presence must never interrupt the visitor's navigation. */ }
    finally { busy = false; }
  }
  heartbeat();
  setInterval(heartbeat, 30000);
  document.addEventListener('visibilitychange', heartbeat);
  window.addEventListener('pageshow', heartbeat);
})();
