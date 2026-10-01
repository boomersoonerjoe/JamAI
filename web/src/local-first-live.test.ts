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
