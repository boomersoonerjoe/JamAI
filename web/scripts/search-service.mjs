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
// Feed search expects topic keywords, not response-format instructions.
export function newsSearchQuery(question) {
  const topic = question.split(/[?!;]/, 1)[0]
    .replace(/\b(?:give|show|provide|write|summari[sz]e|tell)\s+(?:me\s+)?(?:a\s+|the\s+)?(?:short\s+|brief\s+)?(?:summary|sources|headlines|news).*$/i, '')
    .replace(/\b(?:what|happened|happening|happens|is|are|was|were|has|have|the|in|at|on|of|for|and|please|today|tonight|this morning|news|headlines)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return `${topic || 'top'} news`;
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
export function webSearchQuery(question) {
  const cleaned = question.replace(/^(?:please\s+)?(?:research|compare|search (?:for)?|look up|find (?:me)?)(?:\s+)/i, '').replace(/\s*[?;]\s*(?:give|show|provide|summari[sz]e).*$/i, '').replace(/\b(?:give me a (?:short|brief) summary|show sources)\b/gi, '').trim();
  // Put the subject before generic recency/price adjectives; some engines over-weight the first word.
  const words = cleaned.split(/\s+/);
  const modifiers = /^(?:latest|current|recent|best|budget|cheap|affordable)$/i;
  return [...words.filter(w => !modifiers.test(w)), ...words.filter(w => modifiers.test(w))].join(' ');
}
export function parseWebHTML(html, engine) {
  const $ = load(html), sources = [], seen = new Set();
  // Parse only organic result containers, never ads, answer boxes or AI-generated search prose.
  const selector = engine === 'bing' ? '.b_algo' : '.snippet';
  $(selector).each((_, node) => {
    const item = $(node);
    const anchor = engine === 'bing' ? item.find('h2 a').first() : item.find('a').filter((_, a) => $(a).find('.search-snippet-title').length > 0).first();
    let href = anchor.attr('href');
    if (!href) return;
    try {
      const target = new URL(href);
      if (target.hostname === 'www.bing.com' && target.pathname === '/ck/a') {
        const encoded = target.searchParams.get('u');
        if (!encoded?.startsWith('a1')) return;
        href = Buffer.from(encoded.slice(2), 'base64url').toString('utf8');
      }
    } catch { return; }
    const url = publicLink(href);
    if (!url || seen.has(url) || /^(?:www\.)?(?:bing\.com|search\.brave\.com)$/.test(new URL(url).hostname)) return;
    const title = clip(engine === 'bing' ? anchor.text() : anchor.find('.search-snippet-title').text(), 200);
    const caption = engine === 'bing' ? item.find('.b_caption p').first() : item.find('.generic-snippet .content').first();
    caption.find('.news_dt').remove();
    const excerpt = clip(caption.text(), 320);
    if (!title || !excerpt) return;
    seen.add(url); sources.push({ title, url, excerpt, publisher: new URL(url).hostname });
  });
  return sources.slice(0, 4);
}
export async function retrieveWeb(request, signal, requestFetch = fetch, now = new Date()) {
  const query = webSearchQuery(request.query);
  const endpoints = [
    ['brave', 'Brave web search', `https://search.brave.com/search?${new URLSearchParams({q: query, source: 'web'})}`],
    ['bing', 'Bing web search', `https://www.bing.com/search?${new URLSearchParams({q: query})}`],
    ['rss', 'Bing web-search RSS fallback', `https://www.bing.com/search?${new URLSearchParams({q: query, format: 'rss'})}`],
  ];
  const combined = AbortSignal.any([signal, AbortSignal.timeout(25000)]);
  for (const [engine, provider, url] of endpoints) {
    combined.throwIfAborted();
    try {
      const response = await requestFetch(new URL(url), { signal: AbortSignal.any([combined, AbortSignal.timeout(8000)]), redirect: 'error', headers: { Accept: 'text/html,application/rss+xml', 'User-Agent': 'NhomeAI/0.1 local-first personal search' } });
      const text = await boundedText(response);
      const sources = engine === 'rss' ? parseResults(text, request, now) : parseWebHTML(text, engine);
      if (sources.length) return { query: request.query, provider, fetchedAt: now.toISOString(), timeZone: request.timeZone, scope: 'web', sources };
      // Empty/challenge pages are treated as unavailable; never solve or bypass challenges.
    } catch { combined.throwIfAborted(); }
  }
  throw new Error('Free general web search is unavailable or returned no usable results. I cannot verify this question.');
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
  if (request.kind === 'web') return retrieveWeb(request, signal, requestFetch, now);
  let url;
  if (request.kind === 'news') {
    // Expand the upstream date window, then filter exact local-day pubDates below.
    // The search engine's date boundaries need not use the device's time zone.
    const before = new Date(`${request.day}T12:00:00Z`); before.setUTCDate(before.getUTCDate() + 2);
    const after = new Date(`${request.day}T12:00:00Z`); after.setUTCDate(after.getUTCDate() - 1);
    const range = request.today ? `after:${after.toISOString().slice(0, 10)} before:${before.toISOString().slice(0, 10)}` : 'when:7d';
    const query = newsSearchQuery(request.query);
    url = new URL('https://news.google.com/rss/search');
    url.search = new URLSearchParams({ q: `${query} ${range}`, hl: 'en-US', gl: 'US', ceid: 'US:en' }).toString();
  }
  const fetchSources = async target => {
  const response = await requestFetch(target, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), redirect: 'error',
    headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'NhomeAI/0.1 local-first personal search' },
  });
  return parseResults(await boundedText(response), request, now);
  };
  let sources = await fetchSources(url);
  // A second upstream date syntax can recover indexing gaps, never relax the local-day filter.
  if (!sources.length && request.kind === 'news' && request.today) {
    const fallback = new URL(url);
    fallback.searchParams.set('q', `${newsSearchQuery(request.query)} when:1d`);
    sources = await fetchSources(fallback);
  }
  if (!sources.length) throw new Error(request.today && request.kind === 'news' ? `No dated news sources matched ${request.day} in ${request.timeZone}. I cannot verify today's news.` : 'No usable sources were returned. Free search may be temporarily unavailable.');
  return {
    query: request.query, provider: request.kind === 'news' ? 'Google News RSS' : 'Bing web-search RSS',
    fetchedAt: now.toISOString(), timeZone: request.timeZone,
    scope: request.kind === 'news' ? (request.today ? 'today' : 'recent') : 'web', sources,
  };
}
