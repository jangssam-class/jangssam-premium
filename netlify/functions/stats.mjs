import crypto from 'node:crypto';
import {
  getStatsStore,
  json,
  koreaDate,
  readJson
} from './_stats-utils.mjs';

const COOKIE_NAME = 'jangssam_stats_session';
const SESSION_SECONDS = 60 * 60 * 12;

function getPassword() {
  return process.env.STATS_ADMIN_PASSWORD || '';
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function signature(expires, password) {
  return crypto
    .createHmac('sha256', password)
    .update(`jangssam-stats:${expires}`)
    .digest('hex');
}

function makeToken(password) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${expires}.${signature(expires, password)}`;
}

function parseCookies(request) {
  const result = {};
  const raw = request.headers.get('cookie') || '';

  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }

  return result;
}

function authorized(request, password) {
  const token = parseCookies(request)[COOKIE_NAME] || '';
  const [expiresText, suppliedSignature] = token.split('.');
  const expires = Number(expiresText);

  if (!expires || expires < Math.floor(Date.now() / 1000) || !suppliedSignature) {
    return false;
  }

  return safeEqual(suppliedSignature, signature(expires, password));
}

function dayOffset(offset) {
  const date = new Date(Date.now() - offset * 86400000);
  return koreaDate(date);
}

export default async (request) => {
  const password = getPassword();

  if (!password) {
    return json({
      ok: false,
      code: 'SETUP_REQUIRED',
      message: 'Netlify 환경변수 STATS_ADMIN_PASSWORD를 설정해주세요.'
    }, 503);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'summary';

  if (request.method === 'POST' && action === 'login') {
    let supplied = '';

    try {
      supplied = String((await request.json()).password || '');
    } catch (_) {
      return json({ ok: false }, 400);
    }

    if (!safeEqual(supplied, password)) {
      return json({ ok: false, message: '비밀번호가 맞지 않습니다.' }, 401);
    }

    const cookie = `${COOKIE_NAME}=${encodeURIComponent(makeToken(password))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
    return json({ ok: true }, 200, { 'Set-Cookie': cookie });
  }

  if (request.method === 'POST' && action === 'logout') {
    return json({ ok: true }, 200, {
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    });
  }

  if (request.method !== 'GET') {
    return json({ ok: false }, 405);
  }

  if (!authorized(request, password)) {
    return json({ ok: false, code: 'UNAUTHORIZED' }, 401);
  }

  const store = getStatsStore();
  const days = Array.from({ length: 7 }, (_, index) => dayOffset(6 - index));
  const [total, ...daily] = await Promise.all([
    readJson(store, 'count/total', { visitors: 0, pageViews: 0 }),
    ...days.map(day => readJson(store, `count/day/${day}`, { visitors: 0, pageViews: 0 }))
  ]);

  const history = days.map((date, index) => ({
    date,
    visitors: Number(daily[index].visitors || 0),
    pageViews: Number(daily[index].pageViews || 0)
  }));

  const sources = ['네이버', '구글', 'ChatGPT', 'Perplexity', 'Gemini', '외부 사이트', '직접 방문·기타'];
  const pageIndex = await readJson(store, 'detail/page-index', []);
  const pageList = Array.isArray(pageIndex) ? pageIndex.slice(0, 500) : [];
  const [sourceCounts, pageCounts, coverage] = await Promise.all([
    Promise.all(sources.map(source => Promise.all(days.map(day =>
      readJson(store, `detail/source/${day}/${encodeURIComponent(source)}`, { visitors: 0, pageViews: 0 })
    )))),
    Promise.all(pageList.map(path => Promise.all(days.map(day =>
      readJson(store, `detail/page/${day}/${Buffer.from(path).toString('base64url')}`, { visitors: 0, pageViews: 0 })
    )))),
    Promise.all(days.map(day => readJson(store, `detail/covered/${day}`, { visitors: 0, pageViews: 0 })))
  ]);
  const sum = values => values.reduce((acc, v) => ({ visitors: acc.visitors + Number(v.visitors || 0), pageViews: acc.pageViews + Number(v.pageViews || 0) }), { visitors: 0, pageViews: 0 });
  const sourceBreakdown = sources.map((source, i) => ({ source, ...sum(sourceCounts[i]) }));
  const popularPages = pageList.map((path, i) => ({ path, ...sum(pageCounts[i]) }))
    .sort((a, b) => b.pageViews - a.pageViews).slice(0, 10);
  const aiNames = ['ChatGPT', 'Perplexity', 'Gemini'];
  const aiResults = await Promise.all(aiNames.flatMap(source => pageList.map(async path => {
    const key = Buffer.from(path).toString('base64url');
    const values = await Promise.all(days.map(day => readJson(store, `detail/ai/${day}/${encodeURIComponent(source)}/${key}`, { visitors: 0, pageViews: 0 })));
    return { source, path, ...sum(values) };
  })));
  const aiPages = aiResults.filter(x => x.pageViews > 0).sort((a,b) => b.pageViews - a.pageViews).slice(0, 10);
  const aiDaily = await Promise.all(days.map(async day => {
    const values = await Promise.all(aiNames.map(source => readJson(store, `detail/source/${day}/${encodeURIComponent(source)}`, { visitors: 0, pageViews: 0 })));
    return { date: day, ...Object.fromEntries(aiNames.map((source,i) => [source, Number(values[i].pageViews || 0)])) };
  }));
  return json({
    ok: true,
    ai: { pages: aiPages, daily: aiDaily, note: '관심 주제는 방문 페이지 경로를 바탕으로 한 추정이며 실제 ChatGPT 질문 원문이 아닙니다.' },
    detail: { sources: sourceBreakdown, popularPages, coveredPageViews: coverage.reduce((n, d) => n + Number(d.pageViews || 0), 0), period: '최근 7일' },
    today: history[history.length - 1],
    total: {
      visitors: Number(total.visitors || 0),
      pageViews: Number(total.pageViews || 0)
    },
    history,
    startedAfterInstallation: true
  });
};
