(() => {
  'use strict';

  if (location.pathname.startsWith('/admin') || location.pathname === '/private-stats.html') {
    return;
  }

  const storageKey = 'jangssam_visitor_id';
  let visitorId = '';

  try {
    visitorId = localStorage.getItem(storageKey) || '';

    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(storageKey, visitorId);
    }
  } catch (_) {
    visitorId = crypto.randomUUID();
  }

  const payload = JSON.stringify({
    visitorId,
    path: location.pathname
  });

  const endpoint = '/.netlify/functions/visit';

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      endpoint,
      new Blob([payload], { type: 'application/json' })
    );
    return;
  }

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
    credentials: 'same-origin'
  }).catch(() => {});
})();
