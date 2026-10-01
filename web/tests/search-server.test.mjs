import { request as httpRequest } from 'node:http';
import { it, expect } from 'vitest';
import { parseResults, retrieveSearch, validateSearch } from '../scripts/search-service.mjs';
import { makeServer } from '../scripts/server.mjs';
const request = { query: 'Tulsa news today', kind: 'news', today: true, day: '2026-10-01', timeZone: 'America/Chicago' };
const now = new Date('2026-10-02T04:30:00Z');
const feed = items => `<rss><channel>${items.join('')}</channel></rss>`;
const item = (title, date, url = 'https://example.org/story') => `<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate><source>Fixture</source><description>Snippet &amp; details</description></item>`;
it('filters news by device local day, rejects future/undated/private links and deduplicates', () => {
  const xml = feed([
    item('Late local news', 'Fri, 02 Oct 2026 03:30:00 GMT'),
    item('Duplicate', 'Fri, 02 Oct 2026 03:30:00 GMT'),
    item('Previous local day', 'Thu, 01 Oct 2026 01:00:00 GMT', 'https://example.org/old'),
    item('Future item', 'Fri, 02 Oct 2026 05:30:00 GMT', 'https://example.org/future'),
    item('Missing date', '', 'https://example.org/undated'), item('Local target', 'Fri, 02 Oct 2026 03:30:00 GMT', 'http://127.0.0.1/private'),
  ]);
  expect(parseResults(xml, request, now)).toEqual([expect.objectContaining({ title: 'Late local news', excerpt: 'Late local news', publishedAt: '2026-10-02T03:30:00.000Z' })]);
});
it('does not treat web-search RSS dates as article publication dates', () => {
  expect(parseResults(feed([item('Web title', 'Fri, 02 Oct 2026 03:30:00 GMT')]), { ...request, kind: 'web' }, now)[0]).not.toHaveProperty('publishedAt');
});
it('uses fixed free endpoints and broadens upstream dates before exact timezone filtering', async () => {
  let called;
  const data = await retrieveSearch(request, new AbortController().signal, async (url, options) => {
    called = [url, options]; return new Response(feed([item('News', 'Fri, 02 Oct 2026 03:30:00 GMT')]));
  }, now);
  expect(called[0].hostname).toBe('news.google.com'); expect(called[0].searchParams.get('q')).toContain('after:2026-09-30 before:2026-10-03');
  expect(called[1].redirect).toBe('error'); expect(data.sources).toHaveLength(1);
});
it('fails closed for undated today-specific web results, bad responses and oversized feeds', async () => {
  const signal = new AbortController().signal;
  await expect(retrieveSearch({ ...request, kind: 'web' }, signal, async () => new Response(feed([item('Web title', '')])), now)).rejects.toThrow('publication dates');
  await expect(retrieveSearch(request, signal, async () => new Response('Blocked', { status: 429 }), now)).rejects.toThrow('429');
  await expect(retrieveSearch(request, signal, async () => new Response('x'.repeat(1024 * 1024 + 1)), now)).rejects.toThrow('size limit');
});
it('validates inputs without accepting arbitrary upstream targets', () => {
  expect(() => validateSearch({ ...request, query: 'x'.repeat(1201) })).toThrow();
  expect(() => validateSearch({ ...request, timeZone: 'Invalid/Zone' })).toThrow();
  expect(() => validateSearch({ ...request, day: '2026-02-30' })).toThrow();
});
it('enforces loopback origins, JSON/body limits, search errors and traversal guards', async () => {
  const server = makeServer(async () => { throw new Error('Offline fixture'); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = headers => fetch(base + '/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(request) });
  try {
    expect((await send({ Origin: 'https://evil.example' })).status).toBe(403);
    const badHost = await new Promise((resolve, reject) => { const r = httpRequest(base + '/api/search', { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); r.on('error', reject); r.end(); });
    expect(badHost).toBe(403);
    const offline = await send({ Origin: 'http://127.0.0.1:4173' }); expect(offline.status).toBe(503); expect(await offline.json()).toEqual({ error: 'Offline fixture' });
    expect((await fetch(base + '/api/search')).status).toBe(405);
    expect((await fetch(base + '/api/search', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415);
    expect((await fetch(base + '/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(5000) })).status).toBe(413);
    expect((await fetch(base + '/%2e%2e%2fpackage.json')).status).toBe(403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
