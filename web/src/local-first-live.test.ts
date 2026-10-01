import { expect, it } from 'vitest';
import { answerConversation } from './chat-service';
import { deviceContext } from './device-context';
import { OllamaChatProvider } from './ollama-provider';
import type { SearchEvidence } from './search';
const enabled = (globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env.NHOMEAI_LIVE_TEST === '1';
it.skipIf(!enabled)('retrieves live Tulsa news and uses local Ollama to select exact sourced excerpts', async () => {
  const clock = deviceContext();
  const response = await fetch('http://127.0.0.1:4173/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'what happened today in the news in tulsa? give me a short summary and show sources', kind: 'news', today: true, day: clock.localDate, timeZone: clock.timeZone }) });
  expect(response.ok).toBe(true);
  const evidence = await response.json() as SearchEvidence;
  expect(evidence.sources.length).toBeGreaterThan(0);
  const provider = new OllamaChatProvider(); await provider.prepare(() => {});
  const result = await answerConversation({ id: 'live-news', title: 'News', messages: [{ id: 'q', role: 'user', text: 'what happened today in the news in tulsa? give me a short summary and show sources', createdAt: clock.isoTime }] }, [], provider, { mode: 'auto', signal: AbortSignal.timeout(120000), clock: () => clock, search: async () => evidence, onUpdate() {}, onActivity() {} });
  expect(result.retryable).toBe(false);
  expect(result.text).toContain('extractive summary');
  expect(evidence.sources.some(source => result.text.includes(source.excerpt))).toBe(true);
  console.log(JSON.stringify({ clock, result, evidence }, null, 2));
}, 150000);
for (const query of ['current tulsa weather', 'MacBook Air current price', 'Compare latest budget laptops', 'Current events in Oklahoma', 'Research solar panel efficiency']) {
  it.skipIf(!enabled)(`general web retrieval and local source selection: ${query}`, async () => {
    const clock = deviceContext();
    const response = await fetch('http://127.0.0.1:4173/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, kind: 'web', today: /today/i.test(query), day: clock.localDate, timeZone: clock.timeZone }) });
    const evidence = await response.json() as SearchEvidence;
    expect(response.ok, JSON.stringify(evidence)).toBe(true);
    expect(evidence.sources.length).toBeGreaterThan(0);
    if (/weather/i.test(query)) for (const source of evidence.sources) { expect(`${source.title} ${source.url}`).toMatch(/tulsa/i); expect(`${source.title} ${source.url}`).not.toMatch(/waxahachie/i); }
    expect(evidence.provider).toMatch(/web search|Open-Meteo/);
    const provider = new OllamaChatProvider(); await provider.prepare(() => {});
    const result = await answerConversation({ id: 'live-web', title: query, messages: [{ id: 'q', role: 'user', text: query, createdAt: clock.isoTime }] }, [], provider, { mode: 'auto', signal: AbortSignal.timeout(120000), clock: () => clock, search: async () => evidence, onUpdate() {}, onActivity() {} });
    expect(result.retryable).toBe(false);
    expect(result.text).toContain('extractive summary');
    if (evidence.scope === 'weather') expect(result.text).toContain('model-based current weather'); else expect(result.text).toContain('current accuracy are not verified');
    expect(evidence.sources.some(source => result.text.includes(source.excerpt))).toBe(true);
    console.log(JSON.stringify({ query, provider: evidence.provider, sources: evidence.sources, answer: result.text }));
  }, 150000);
}
