(() => {
  'use strict';
  const script = document.currentScript;
  const api = new URL('../api/visitors', script.src);
  let busy = false, lastSent = 0;
  const newTabId = () => crypto.randomUUID().replaceAll('-', '');
  let tabId = newTabId(), departed = false;
  async function heartbeat() {
    if (departed || document.hidden || busy || Date.now() - lastSent < 25000) return;
    busy = true;
    lastSent = Date.now();
    try {
      await fetch(api, {method:'POST', credentials:'same-origin', cache:'no-store',
        headers:{'Content-Type':'application/json'}, body:JSON.stringify({page:location.pathname, tabId}),
        signal:AbortSignal.timeout(8000)});
    } catch (_) { /* Presence must never interrupt the visitor's navigation. */ }
    finally { busy = false; }
  }
  heartbeat();
  setInterval(heartbeat, 30000);
  document.addEventListener('visibilitychange', heartbeat);
  window.addEventListener('pagehide', () => {
    if (departed) return;
    departed = true;
    const body = JSON.stringify({action:'leave', tabId});
    try {
      if (navigator.sendBeacon(api, new Blob([body], {type:'application/json'}))) return;
    } catch (_) {}
    fetch(api, {method:'POST', credentials:'same-origin', keepalive:true, headers:{'Content-Type':'application/json'}, body}).catch(() => {});
  });
  window.addEventListener('pageshow', () => {
    if (departed) { tabId = newTabId(); departed = false; lastSent = 0; }
    heartbeat();
  });
})();
