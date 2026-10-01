import { load } from 'cheerio';

const MAX_BYTES = 1024 * 1024;
const plain = value => {
  const $ = load(value || ''); $('script,style').remove();
  return $.text().replace(/\s+/g, ' ').trim();
};
const clip = (value, limit) => Array.from(plain(value)).slice(0, limit).join('');
export function publicLink(value) {
  try {
    const u = new URL(value);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)) return undefined;
    return u.href;
  } catch { return undefined; }
}
export function validateSearch(input) {
  if (!input || typeof input.query !== 'string' || !input.query.trim() || Buffer.byteLength(input.query) > 1200) throw new Error('Search query must contain 1–1,200 UTF-8 bytes.');
  if (!['web', 'news'].includes(input.kind) || typeof input.today !== 'boolean') throw new Error('Invalid search mode.');
  if (typeof input.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.day) || new Date(`${input.day}T12:00:00Z`).toISOString().slice(0, 10) !== input.day) throw new Error('Invalid device date.');
  if (typeof input.timeZone !== 'string') throw new Error('Missing device time zone.');
  new Intl.DateTimeFormat('en', { timeZone: input.timeZone });
  return { query: input.query.trim(), kind: input.kind, today: input.today, day: input.day, timeZone: input.timeZone };
}
function localDay(iso, timeZone) {
  const p = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = type => p.find(x => x.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function parseResults(xml, request, now = new Date()) {
  const $ = load(xml, { xmlMode: true });
  if (!$('rss channel').length) throw new Error('Search returned an unsupported response.');
  const sources = [], seen = new Set();
  $('channel > item').each((_, node) => {
    const item = $(node), url = publicLink(item.find('link').first().text().trim());
    if (!url || seen.has(url)) return;
    const publisher = clip(item.find('source').text(), 100);
    let title = clip(item.find('title').text(), 200);
    if (publisher && title.endsWith(` - ${publisher}`)) title = title.slice(0, -(publisher.length + 3));
    if (!title) return;
    let publishedAt;
    // Bing's RSS pubDate is not a reliable article publication date: never promote it to one.
    if (request.kind === 'news') {
      const timestamp = Date.parse(item.find('pubDate').text());
      if (!Number.isFinite(timestamp) || timestamp > now.getTime() + 300000) return;
      publishedAt = new Date(timestamp).toISOString();
      if (request.today && localDay(publishedAt, request.timeZone) !== request.day) return;
    }
    const excerpt = request.kind === 'news' ? title : clip(item.find('description').text(), 320);
    if (!excerpt) return;
    seen.add(url); sources.push({ title, url, excerpt, ...(publisher ? { publisher } : {}), ...(publishedAt ? { publishedAt } : {}) });
  });
  return sources.slice(0, 4);
}
async function boundedText(response) {
  if (!response.ok) throw new Error(`Free search returned HTTP ${response.status}.`);
  if (!response.body) throw new Error('Search returned an empty response.');
  const reader = response.body.getReader(); const buffers = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > MAX_BYTES) throw new Error('Search response exceeded the safe size limit.');
      buffers.push(Buffer.from(value));
    }
    return Buffer.concat(buffers).toString('utf8');
  } finally { await reader.cancel(); reader.releaseLock(); }
}
export async function retrieveSearch(input, signal, requestFetch = fetch, now = new Date()) {
  const request = validateSearch(input);
  let url;
  if (request.kind === 'news') {
    // Expand the upstream date window, then filter exact local-day pubDates below.
    // The search engine's date boundaries need not use the device's time zone.
    const before = new Date(`${request.day}T12:00:00Z`); before.setUTCDate(before.getUTCDate() + 2);
    const after = new Date(`${request.day}T12:00:00Z`); after.setUTCDate(after.getUTCDate() - 1);
    const range = request.today ? `after:${after.toISOString().slice(0, 10)} before:${before.toISOString().slice(0, 10)}` : 'when:7d';
    const query = request.today ? request.query.replace(/\b(today|tonight|this morning)\b/gi, '').trim() : request.query;
    url = new URL('https://news.google.com/rss/search');
    url.search = new URLSearchParams({ q: `${query} ${range}`, hl: 'en-US', gl: 'US', ceid: 'US:en' }).toString();
  } else {
    url = new URL('https://www.bing.com/search'); url.search = new URLSearchParams({ format: 'rss', q: request.query }).toString();
  }
  const response = await requestFetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), redirect: 'error',
    headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'NhomeAI/0.1 local-first personal search' },
  });
  const sources = parseResults(await boundedText(response), request, now);
  if (!sources.length) throw new Error(request.today && request.kind === 'news' ? `No dated news sources matched ${request.day} in ${request.timeZone}. I cannot verify today's news.` : 'No usable sources were returned. Free search may be temporarily unavailable.');
  // General web results have unknown publication dates. A today-specific answer cannot safely rely on them.
  if (request.today && request.kind === 'web') throw new Error('Web search returned snippets without verified publication dates. I cannot verify a today-specific answer from them. For news, include “news” in your query.');
  return {
    query: request.query, provider: request.kind === 'news' ? 'Google News RSS' : 'Bing web-search RSS',
    fetchedAt: now.toISOString(), timeZone: request.timeZone,
    scope: request.kind === 'news' ? (request.today ? 'today' : 'recent') : 'web', sources,
  };
}
