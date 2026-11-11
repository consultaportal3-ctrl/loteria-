(() => {
  'use strict';
  const script = document.currentScript;
  const api = new URL('../api/visitors', script.src);
  let lastSent = 0, lastPage = '', section = '', sending = false;
  const pending = [];
  const newTabId = () => crypto.randomUUID().replaceAll('-', '');
  let tabId = newTabId(), departed = false;
  const page = () => location.pathname + (section ? '#' + section : /^#[a-zA-Z0-9_-]{1,80}$/.test(location.hash) ? location.hash : '');
  async function flush() {
    if (sending || departed) return;
    sending = true;
    try {
      while (pending.length && !departed) {
        const entry = pending[0];
        try {
          const response = await fetch(api, {method:'POST', credentials:'same-origin', cache:'no-store',
            headers:{'Content-Type':'application/json'}, body:JSON.stringify(entry.body), signal:AbortSignal.timeout(8000)});
          if (!response.ok && response.status >= 500) throw new Error('Tracking unavailable');
          pending.shift();
        } catch (_) {
          if (++entry.attempts >= 3) pending.shift();
          setTimeout(flush, 2000);
          break;
        }
      }
    } finally { sending = false; }
  }
  function enqueue(body) {
    if (departed || pending.length >= 100) return;
    pending.push({body, attempts:0}); flush();
  }
  function heartbeat() {
    if (departed || document.hidden) return;
    const current = page();
    if (current === lastPage && Date.now() - lastSent < 25000) return;
    lastSent = Date.now(); lastPage = current;
    enqueue({page:current, tabId});
  }
  heartbeat();
  setInterval(heartbeat, 30000);
  document.addEventListener('visibilitychange', heartbeat);
  window.addEventListener('hashchange', () => { section = ''; heartbeat(); });
  window.addEventListener('popstate', () => { section = ''; heartbeat(); });
  window.addEventListener('portal:visitor-section', event => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(event.detail || '')) return;
    section = event.detail; heartbeat();
  });
  window.addEventListener('portal:generated-game', event => {
    if (!event.detail) return;
    heartbeat();
    const item = {...event.detail};
    const draw = window.homeProductReference?.draws[item.special === 'virada' ? 'virada' : item.game];
    if (!item.contest && draw) item.contest = Number(draw.contest);
    enqueue({action:'activity', type:'generated_game', eventId:crypto.randomUUID(), tabId, item});
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible || (location.hash && !['#inicio','#modalidades','#combos','#baixar-aplicativo'].includes(location.hash))) return;
      const rect = visible.target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      section = visible.target.id; heartbeat();
    }, {rootMargin:'-15% 0px -45% 0px', threshold:0});
    document.querySelectorAll('#inicio,#modalidades,#combos,#baixar-aplicativo').forEach(element => observer.observe(element));
  }
  window.addEventListener('pagehide', () => {
    if (departed) return;
    departed = true;
    for (const entry of pending.filter(entry => entry.body.action === 'activity')) {
      try { navigator.sendBeacon(api, new Blob([JSON.stringify(entry.body)], {type:'application/json'})); } catch (_) {}
    }
    pending.length = 0;
    const body = JSON.stringify({action:'leave', tabId});
    try {
      if (navigator.sendBeacon(api, new Blob([body], {type:'application/json'}))) return;
    } catch (_) {}
    fetch(api, {method:'POST', credentials:'same-origin', keepalive:true, headers:{'Content-Type':'application/json'}, body}).catch(() => {});
  });
  window.addEventListener('pageshow', () => {
    if (departed) { tabId = newTabId(); departed = false; lastSent = 0; lastPage = ''; }
    heartbeat();
  });
})();
