import { request as httpRequest } from 'node:http';
import { it, expect } from 'vitest';
import { parseResults, retrieveSearch, validateSearch, newsSearchQuery, parseWebHTML, retrieveWeb, webSearchQuery, weatherLocation, matchesWeatherLocation, retrieveCurrentWeather } from '../scripts/search-service.mjs';
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
  const web = await retrieveSearch({ ...request, kind: 'web' }, signal, async () => new Response(feed([item('Web title', '')])), now);
  expect(web.scope).toBe('web'); expect(web.sources[0]).not.toHaveProperty('publishedAt');
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

it('normalizes conversational local news queries without response instructions', () => {
  expect(newsSearchQuery('what happened today in the news in tulsa? give me a short summary and show sources')).toBe('tulsa news');
  expect(newsSearchQuery('Tulsa news today')).toBe('Tulsa news');
  expect(newsSearchQuery('What happened today in Oklahoma City? Show sources')).toBe('Oklahoma City news');
});
it('retries an empty date-range feed while retaining exact local-day filtering', async () => {
  const queries = [];
  const data = await retrieveSearch(request, new AbortController().signal, async url => {
    queries.push(url.searchParams.get('q'));
    return new Response(feed(queries.length === 1 ? [] : [item('Recovered news', 'Fri, 02 Oct 2026 03:30:00 GMT'), item('Old news', 'Wed, 30 Sep 2026 12:00:00 GMT', 'https://example.org/old')]));
  }, now);
  expect(queries).toHaveLength(2); expect(queries[1]).toBe('Tulsa news when:1d');
  expect(data.sources).toHaveLength(1); expect(data.sources[0].title).toBe('Recovered news');
});

it('extracts organic HTML results and decodes Bing links without promoting search dates', () => {
  const u = 'a1' + Buffer.from('https://example.org/product').toString('base64url');
  const html = `<li class="b_algo"><h2><a href="https://www.bing.com/ck/a?u=${u}">Product</a></h2><div class="b_caption"><p><span class="news_dt">today</span>Listed price $10</p></div></li>`;
  expect(parseWebHTML(html, 'bing')).toEqual([{title:'Product', url:'https://example.org/product', excerpt:'Listed price $10', publisher:'example.org'}]);
  expect(parseWebHTML(html.replace(u, 'a1'+Buffer.from('http://127.0.0.1/private').toString('base64url')), 'bing')).toEqual([]);
  expect(parseWebHTML('<h2>Challenge</h2>', 'bing')).toEqual([]);
});
it('falls back to a second free HTML engine, preserving query privacy and cancellation', async () => {
  const calls = [];
  const result = await retrieveWeb({...request, kind:'web'}, new AbortController().signal, async url => {
    calls.push(url.hostname);
    return new Response(calls.length === 1 ? 'Unavailable' : '<li class="b_algo"><h2><a href="https://example.org/research">Research</a></h2><div class="b_caption"><p>Sourced excerpt</p></div></li>');
  }, now);
  expect(calls).toEqual(['search.brave.com','www.bing.com']); expect(result.provider).toBe('Bing web search');
  const abort = new AbortController(); abort.abort();
  await expect(retrieveWeb(request,abort.signal)).rejects.toMatchObject({name:'AbortError'});
});

it('normalizes research and comparison commands into subject-first search queries', () => {
  expect(webSearchQuery('Research solar panel efficiency')).toBe('Research solar panel efficiency');
  expect(webSearchQuery('Compare latest budget laptops')).toBe('Compare latest budget laptops');
});
it('fails explicitly when all public engines are unavailable and ignores arbitrary upstream parameters', async () => {
  const calls = [];
  await expect(retrieveWeb({...request, kind:'web', url:'http://127.0.0.1/private'},new AbortController().signal,async url => { calls.push(url.hostname); return new Response('Unavailable',{status:429}); },now)).rejects.toThrow('unavailable');
  expect(calls).toEqual(['search.brave.com','www.bing.com','www.bing.com']);
});

it('preserves locations, details, spelling and order in outgoing web queries', async () => {
  const query = 'current Tulsa, OK weather in Fahrenheit';
  const calls = [];
  await retrieveWeb({...request, query,kind:'web'},new AbortController().signal,async url => {
    if (url.searchParams.has('q')) calls.push(url.searchParams.get('q'));
    return new Response('<li class="b_algo"><h2><a href="https://example.org/weather/tulsa-ok">Tulsa, OK Weather</a></h2><div class="b_caption"><p>Weather source</p></div></li>');
  },now);
  expect(calls.every(value => value === query)).toBe(true);
});
it('rejects another city and requires an actual weather page for the requested location', () => {
  expect(weatherLocation('current tulsa weather')).toBe('tulsa');
  expect(weatherLocation('What is the current weather in Tulsa, OK today?')).toBe('Tulsa, OK');
  expect(matchesWeatherLocation({title:'Waxahachie, TX Weather',url:'https://weather.example/waxahachie'},'Tulsa')).toBe(false);
  expect(matchesWeatherLocation({title:'Tulsa, OK Weather',url:'https://weather.example/tulsa'},'Tulsa')).toBe(true);
  expect(matchesWeatherLocation({title:'City of Tulsa',url:'https://cityoftulsa.org/'},'Tulsa')).toBe(false);
});
it('discards Waxahachie weather and preserves important details on every retry', async () => {
  const query = 'What is the current Tulsa weather?'; const calls = [];
  const source = (city) => `<div class="snippet"><a href="https://example.org/weather/${city.toLowerCase()}"><div class="search-snippet-title">${city} Weather</div></a><div class="generic-snippet"><div class="content">Weather conditions</div></div></div>`;
  const result = await retrieveWeb({...request,query,kind:'web'},new AbortController().signal,async url => {
    if (url.searchParams.has('q')) calls.push(url.searchParams.get('q'));
    if (calls.length === 1) return new Response(source('Waxahachie'));
    if (calls.length < 4) return new Response('Unavailable',{status:503});
    return new Response(source('Tulsa'));
  },now);
  expect(result.sources).toHaveLength(1); expect(result.sources[0].title).toBe('Tulsa Weather');
  expect(calls[0]).toBe(query);
  expect(calls.every(value => value.includes('current Tulsa weather'))).toBe(true);
});

it('resolves exact weather city/state, preserves Celsius and rejects stale/wrong-city API data', async () => {
  const place = {name:'Tulsa',admin1:'Oklahoma',country:'United States',country_code:'US',population:400000,latitude:36.15,longitude:-95.99};
  const c = {time:now.getTime()/1000,temperature_2m:20,apparent_temperature:19,relative_humidity_2m:50,wind_speed_10m:10};
  const u = {temperature_2m:'°C',apparent_temperature:'°C',relative_humidity_2m:'%',wind_speed_10m:'km/h'};
  const fetcher = async url => {
    if (url.hostname === 'geocoding-api.open-meteo.com') { expect(url.searchParams.get('name')).toBe('Tulsa'); return new Response(JSON.stringify({results:[place]})); }
    expect(url.searchParams.get('temperature_unit')).toBe('celsius');
    return new Response(JSON.stringify({current:c,current_units:u}));
  };
  const data = await retrieveCurrentWeather({...request,query:'current Tulsa, OK weather in Celsius'},'Tulsa, OK',new AbortController().signal,fetcher,now);
  expect(data.sources[0].excerpt).toContain('Tulsa, Oklahoma'); expect(data.sources[0].excerpt).toContain('20°C');
  await expect(retrieveCurrentWeather(request,'Tulsa, TX',new AbortController().signal,fetcher,now)).rejects.toThrow('location');
  await expect(retrieveCurrentWeather(request,'Tulsa',new AbortController().signal,async url => new Response(JSON.stringify(url.hostname.includes('geocoding') ? {results:[place]} : {current:{...c,time:c.time-10000},current_units:u})),now)).rejects.toThrow('stale');
});
