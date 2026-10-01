import { expect, it } from 'vitest';
import { OllamaChatProvider } from './ollama-provider';
import { buildPrompt } from './context';

// Opt in only after the local daemon and weights are installed; never download in tests.
const enabled = (globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env.NHOMEAI_LIVE_TEST === '1';
it.skipIf(!enabled)('streams real local inference and recalls app-owned context', async () => {
  const provider = new OllamaChatProvider();
  await provider.prepare(() => {});
  const updates: string[] = [];
  const first = await provider.generate({ prompt: 'Remember the number 7429. Briefly acknowledge.' }, text => updates.push(text), AbortSignal.timeout(120000));
  expect(first.trim().length).toBeGreaterThan(0);
  expect(updates.length).toBeGreaterThan(0);
  const prompt = buildPrompt({ id: 'live', title: 'Live test', messages: [
    { id: '1', role: 'user', text: 'Remember the number 7429.', createdAt: '' },
    { id: '2', role: 'assistant', text: first, createdAt: '' },
    { id: '3', role: 'user', text: 'What number did I ask you to remember? Reply only with the number.', createdAt: '' },
  ] }, []);
  const recall = await provider.generate({ prompt }, () => {}, AbortSignal.timeout(120000));
  expect(recall).toContain('7429');
  console.log(JSON.stringify({ first, recall, streamingUpdates: updates.length }));
}, 240000);
