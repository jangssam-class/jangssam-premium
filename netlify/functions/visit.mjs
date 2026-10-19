import {
  addVisit,
  getStatsStore,
  hashVisitor,
  json,
  koreaDate,
  registerPage
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

  const sourceText = String(body.campaignSource || '').toLowerCase().slice(0, 80);
  let source = '직접 방문·기타';
  const referrer = String(body.referrer || '').slice(0, 1000);
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase(); } catch (_) {}
  const ownHost = host === 'jangssam-premium.netlify.app';
  if (!ownHost) {
    if (/(chatgpt|openai)/.test(sourceText) || /(^|\.)chatgpt\.com$|(^|\.)openai\.com$/.test(host)) source = 'ChatGPT';
    else if (/perplexity/.test(sourceText) || /(^|\.)perplexity\.ai$/.test(host)) source = 'Perplexity';
    else if (/gemini/.test(sourceText) || /(^|\.)gemini\.google\.com$/.test(host)) source = 'Gemini';
    else if (/naver/.test(sourceText) || /(^|\.)naver\.com$/.test(host)) source = '네이버';
    else if (/google/.test(sourceText) || /(^|\.)google\.[a-z.]+$/.test(host)) source = '구글';
    else if (host) source = '외부 사이트';
  }
  const cleanPath = (() => {
    try { return new URL(pagePath, 'https://jangssam-premium.netlify.app').pathname.slice(0, 220); }
    catch (_) { return '/'; }
  })();
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

  // 상세 집계는 별도 키에 저장하여 기존 누적 수치를 유지합니다.
  const pathKey = Buffer.from(cleanPath).toString('base64url');
  const sourceKey = encodeURIComponent(source);
  const detailMarker = `detail/visitor/${day}/${visitorHash}`;
  const pageMarker = `detail/page-visitor/${day}/${pathKey}/${visitorHash}`;
  const sourceMarker = `detail/source-visitor/${day}/${sourceKey}/${visitorHash}`;
  const [detailFirst, pageFirst, sourceFirst] = await Promise.all([
    store.set(detailMarker, '1', { onlyIfNew: true }),
    store.set(pageMarker, '1', { onlyIfNew: true }),
    store.set(sourceMarker, '1', { onlyIfNew: true })
  ]);
  // AI 유입은 날짜·페이지별 집계만 저장합니다. 질문 원문이나 개인정보는 수집하지 않습니다.
  const aiSources = ['ChatGPT', 'Perplexity', 'Gemini'];
  if (aiSources.includes(source)) {
    const aiMarker = `detail/ai-visitor/${day}/${sourceKey}/${pathKey}/${visitorHash}`;
    const first = await store.set(aiMarker, '1', { onlyIfNew: true });
    await addVisit(store, `detail/ai/${day}/${sourceKey}/${pathKey}`, first.modified ? 1 : 0);
  }
  await registerPage(store, cleanPath);
  await Promise.all([
    addVisit(store, `detail/source/${day}/${sourceKey}`, sourceFirst.modified ? 1 : 0),
    addVisit(store, `detail/page/${day}/${pathKey}`, pageFirst.modified ? 1 : 0),
    addVisit(store, `detail/covered/${day}`, detailFirst.modified ? 1 : 0)
  ]);
  return json({ ok: true });
};
