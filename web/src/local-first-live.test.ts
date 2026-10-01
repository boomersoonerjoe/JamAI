import { expect, it } from 'vitest';
import { answerConversation } from './chat-service';
import { deviceContext } from './device-context';
import { OllamaChatProvider } from './ollama-provider';
import type { SearchEvidence } from './search';
const enabled = (globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env.NHOMEAI_LIVE_TEST === '1';
it.skipIf(!enabled)('retrieves live Tulsa news and uses local Ollama to write cited conversational summaries', async () => {
  const clock = deviceContext();
  const response = await fetch('http://127.0.0.1:4173/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'what happened today in the news in tulsa? give me a short summary and show sources', kind: 'news', today: true, day: clock.localDate, timeZone: clock.timeZone }) });
  expect(response.ok).toBe(true);
  const evidence = await response.json() as SearchEvidence;
  expect(evidence.sources.length).toBeGreaterThan(0);
  const provider = new OllamaChatProvider(); await provider.prepare(() => {});
  const generate = provider.generate.bind(provider); provider.generate = async (...args) => { const raw = await generate(...args); console.log(JSON.stringify({rawAnswer:raw})); return raw; };
  const result = await answerConversation({ id: 'live-news', title: 'News', messages: [{ id: 'q', role: 'user', text: 'what happened today in the news in tulsa? give me a short summary and show sources', createdAt: clock.isoTime }] }, [], provider, { mode: 'auto', signal: AbortSignal.timeout(120000), clock: () => clock, search: async () => evidence, onUpdate() {}, onActivity() {} });
  expect(result.retryable).toBe(false);
  expect(result.text).toMatch(/\[\d+\]/);
  expect(result.text).not.toContain('extractive summary');
  expect(result.text.length).toBeGreaterThan(50);
  console.log(JSON.stringify({ clock, result, evidence }, null, 2));
}, 150000);
for (const query of ['current tulsa weather', 'MacBook Air current price', 'Compare latest budget laptops', 'Current events in Oklahoma', 'Research solar panel efficiency']) {
  it.skipIf(!enabled)(`general web retrieval and local conversational answer: ${query}`, async () => {
    const clock = deviceContext();
    const response = await fetch('http://127.0.0.1:4173/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, kind: 'web', today: /today/i.test(query), day: clock.localDate, timeZone: clock.timeZone }) });
    const evidence = await response.json() as SearchEvidence;
    expect(response.ok, JSON.stringify(evidence)).toBe(true);
    expect(evidence.sources.length).toBeGreaterThan(0);
    if (/weather/i.test(query)) for (const source of evidence.sources) { expect(`${source.title} ${source.url}`).toMatch(/tulsa/i); expect(`${source.title} ${source.url}`).not.toMatch(/waxahachie/i); }
    expect(evidence.provider).toMatch(/web search|Open-Meteo/);
    const provider = new OllamaChatProvider(); await provider.prepare(() => {});
    const generate = provider.generate.bind(provider); provider.generate = async (...args) => { const raw = await generate(...args); console.log(JSON.stringify({rawAnswer:raw})); return raw; };
  const result = await answerConversation({ id: 'live-web', title: query, messages: [{ id: 'q', role: 'user', text: query, createdAt: clock.isoTime }] }, [], provider, { mode: 'auto', signal: AbortSignal.timeout(120000), clock: () => clock, search: async () => evidence, onUpdate() {}, onActivity() {} });
    expect(result.retryable).toBe(false);
    if (result.text.includes("don't contain enough information")) { expect(['Research solar panel efficiency','Current events in Oklahoma']).toContain(query); } else { expect(result.text).toMatch(/\[\d+\]/); }
    expect(result.text).not.toContain('extractive summary');
    if (evidence.scope === 'weather') expect(result.text).toContain('weather-model estimate'); else if (!result.text.includes("don't contain enough information")) expect(result.text).toContain('not independently verified');
    expect(result.text.length).toBeGreaterThan(50);
    console.log(JSON.stringify({ query, provider: evidence.provider, sources: evidence.sources, answer: result.text }));
  }, 150000);
}
for (const [query,kind] of [
  ['Current weather in Tulsa, OK in Celsius','web'],
  ['Current weather in Oklahoma City, OK','web'],
  ['Current weather in Waxahachie, TX','web'],
  ['Oklahoma City news today','news'],
  ['United States news today','news'],
  ['iPhone current price','web'],
] as const) {
  it.skipIf(!enabled)(`additional conversational live question: ${query}`,async () => {
    const clock = deviceContext();
    const response = await fetch('http://127.0.0.1:4173/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,kind,today:/today/i.test(query),day:clock.localDate,timeZone:clock.timeZone})});
    const evidence = await response.json() as SearchEvidence;
    expect(response.ok,JSON.stringify(evidence)).toBe(true); expect(evidence.sources.length).toBeGreaterThan(0);
    const provider = new OllamaChatProvider(); await provider.prepare(()=>{});
    const generate = provider.generate.bind(provider); provider.generate = async (...args) => { const raw = await generate(...args); console.log(JSON.stringify({rawAnswer:raw})); return raw; };
  const result = await answerConversation({id:'additional',title:query,messages:[{id:'q',role:'user',text:query,createdAt:clock.isoTime}]},[],provider,{mode:'auto',signal:AbortSignal.timeout(120000),clock:()=>clock,search:async()=>evidence,onUpdate(){},onActivity(){}});
    console.log(JSON.stringify({query,evidence,answer:result.text,retryable:result.retryable}));
    expect(result.retryable).toBe(false); expect(result.text).toMatch(/\[\d+\]/); expect(result.text).not.toContain('extractive summary');
    if (/Celsius/i.test(query)) expect(result.text).toContain('°C');
    if (/Waxahachie/i.test(query)) expect(result.text).toContain('Waxahachie');
    if (/Oklahoma City.*weather|weather.*Oklahoma City/i.test(query)) expect(result.text).toContain('Oklahoma City');
  },150000);
}
