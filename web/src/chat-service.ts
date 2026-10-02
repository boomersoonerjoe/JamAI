import type { Conversation, MemoryNote } from './types';
import type { ChatProvider } from './provider';
import { buildPrompt } from './context';
import { deviceContext, isDeviceClockQuestion, clockAnswer, type DeviceContext } from './device-context';
import { needsCurrentInformation, wantsSources, searchInternet, type SearchMode, type SearchEvidence } from './search';
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
  if (current) {
    try {
      if (options.mode === 'off') throw new Error('Internet search is turned off.');
      options.onActivity('Searching free internet sources…');
      evidence = await (options.search ?? searchInternet)(question, clock, options.signal, options.mode === 'web' ? 'web' : undefined);
      options.signal.throwIfAborted();
      if (!evidence.sources.length) throw new Error('No usable sources were retrieved.');
    } catch (error) {
      options.signal.throwIfAborted();
      const text = "I couldn't retrieve live information right now. Please try again when internet search is available.";
      options.onUpdate(text); return { text, retryable: true };
    }
  }
  options.onActivity(evidence ? 'Local AI is summarizing retrieved sources…' : 'Local AI is replying…');
  const showSources = wantsSources(question);
  const visibleEvidence = showSources ? evidence : undefined;
  const text = await provider.generate({ prompt, device: clock, evidence, showSources }, text => options.onUpdate(text, visibleEvidence), options.signal);
  options.signal.throwIfAborted();
  return { text, evidence: visibleEvidence, retryable: false };
}
