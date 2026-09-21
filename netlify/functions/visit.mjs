import {
  addVisit,
  getStatsStore,
  hashVisitor,
  json,
  koreaDate
} from './_stats-utils.mjs';

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ ok: false }, 405, { Allow: 'POST' });
  }

  let body;

  try {
    body = await request.json();
  } catch (_) {
    return json({ ok: false }, 400);
  }

  const visitorId = String(body.visitorId || '');
  const pagePath = String(body.path || '/').slice(0, 300);

  if (!/^[a-zA-Z0-9-]{20,80}$/.test(visitorId) || !pagePath.startsWith('/')) {
    return json({ ok: false }, 400);
  }

  const store = getStatsStore();
  const day = koreaDate();
  const visitorHash = hashVisitor(visitorId);
  const dailyMarker = `visitor/day/${day}/${visitorHash}`;
  const totalMarker = `visitor/all/${visitorHash}`;

  const [dailyMarkerResult, totalMarkerResult] = await Promise.all([
    store.set(dailyMarker, '1', { onlyIfNew: true }),
    store.set(totalMarker, '1', { onlyIfNew: true })
  ]);

  await Promise.all([
    addVisit(store, `count/day/${day}`, dailyMarkerResult.modified ? 1 : 0),
    addVisit(store, 'count/total', totalMarkerResult.modified ? 1 : 0)
  ]);

  return json({ ok: true });
};
