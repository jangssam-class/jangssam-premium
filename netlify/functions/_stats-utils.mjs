import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'jangssam-private-stats';

export function getStatsStore() {
  return getStore(STORE_NAME);
}

export function koreaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function hashVisitor(visitorId) {
  return crypto
    .createHash('sha256')
    .update(String(visitorId))
    .digest('hex');
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      ...extraHeaders
    }
  });
}

export async function readJson(store, key, fallback) {
  try {
    return await store.get(key, {
      type: 'json',
      consistency: 'strong'
    }) || fallback;
  } catch (_) {
    return fallback;
  }
}

export async function addVisit(store, key, visitorDelta) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await store.getWithMetadata(key, {
      type: 'json',
      consistency: 'strong'
    });

    const previous = current?.data || { visitors: 0, pageViews: 0 };
    const next = {
      visitors: Number(previous.visitors || 0) + visitorDelta,
      pageViews: Number(previous.pageViews || 0) + 1
    };

    const result = current
      ? await store.setJSON(key, next, { onlyIfMatch: current.etag })
      : await store.setJSON(key, next, { onlyIfNew: true });

    if (result.modified) return next;
  }

  throw new Error('통계 저장 충돌이 반복되었습니다.');
}
