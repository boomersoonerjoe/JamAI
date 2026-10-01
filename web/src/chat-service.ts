import type { Conversation, MemoryNote } from './types';
import type { ChatProvider } from './provider';
import { buildPrompt } from './context';
import { deviceContext, isDeviceClockQuestion, clockAnswer, type DeviceContext } from './device-context';
import { needsCurrentInformation, searchInternet, type SearchMode, type SearchEvidence } from './search';
interface AnswerOptions {
  mode: SearchMode; signal: AbortSignal;
  onUpdate(text: string, evidence?: SearchEvidence): void;
  onActivity(message: string): void;
  clock?: () => DeviceContext;
  search?: typeof searchInternet;
}
export async function answerConversation(conversation: Conversation, memories: MemoryNote[], provider: ChatProvider, options: AnswerOptions) {
  const prompt = buildPrompt(conversation, memories);
  const question = conversation.messages.at(-1)!.text;
  const clock = (options.clock ?? deviceContext)();
  options.signal.throwIfAborted();
  if (isDeviceClockQuestion(question)) {
    const text = clockAnswer(clock); options.onUpdate(text); return { text, retryable: false };
  }
  const current = needsCurrentInformation(question);
  let evidence: SearchEvidence | undefined;
  if (current || options.mode === 'always' || options.mode === 'web') {
    try {
      if (options.mode === 'off') throw new Error('Internet search is turned off.');
      options.onActivity('Searching free internet sources…');
      evidence = await (options.search ?? searchInternet)(question, clock, options.signal, options.mode === 'web' ? 'web' : undefined);
      options.signal.throwIfAborted();
      if (!evidence.sources.length) throw new Error('No usable sources were retrieved.');
    } catch (error) {
      options.signal.throwIfAborted();
      const reason = error instanceof Error ? error.message : 'Search failed.';
      const text = `I can't verify current information for this question. ${reason}\nI won't guess or fill in news, weather, prices or other changing facts from memory. Ordinary local chat and the device clock still work offline. Enable search or reconnect and retry.`;
      options.onUpdate(text); return { text, retryable: true };
    }
  }
  options.onActivity(evidence ? 'Local AI is summarizing retrieved sources…' : 'Local AI is replying…');
  if (evidence) {
    // Current facts are extractive: the model ranks excerpts, never authors new factual prose.
    // Do not publish model output until the source identifiers have passed validation.
    const raw = await provider.generate({ prompt, device: clock, evidence, responseKind: 'source-selection' }, () => {}, options.signal);
    options.signal.throwIfAborted();
    let selected: number[];
    try {
      const data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as { selected?: unknown };
      if (!Array.isArray(data.selected) || data.selected.length > 4 || data.selected.some(n => !Number.isInteger(n) || n < 1 || n > evidence!.sources.length) || new Set(data.selected).size !== data.selected.length) throw new Error('Invalid source selection.');
      selected = data.selected;
    } catch {
      const text = "Sources were retrieved, but I couldn't validate the local AI's summary. I won't present unverified current facts. Open the sources or retrieved excerpts below, or retry.";
      options.onUpdate(text, evidence); return { text, evidence, retryable: true };
    }
    const scope = evidence.scope === 'today' ? `News published on ${clock.localDate} in ${clock.timeZone}` : evidence.scope === 'weather' ? 'Current weather model estimate' : 'Retrieved search excerpts';
    const text = selected.length ? `${scope} — an extractive summary selected by local AI:\n${selected.map(n => `• “${evidence!.sources[n - 1].excerpt}” [${n}]`).join('\n')}\n\n${evidence.scope === 'weather' ? 'Source: Open-Meteo. Model estimate, not a station observation; resolved location and data time are shown above.' : 'These are source headlines/snippets, not full articles or complete coverage.'}${evidence.scope === 'web' ? ' Their publication dates and current accuracy are not verified.' : ''}` : "The retrieved excerpts don't verify an answer to your question. I won't guess. See the sources below.";
    options.onUpdate(text, evidence); return { text, evidence, retryable: false };
  }
  const text = await provider.generate({ prompt, device: clock }, text => options.onUpdate(text), options.signal);
  return { text, retryable: false };
}
