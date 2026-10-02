import type { Conversation, MemoryNote } from './types';
import type { ChatProvider } from './provider';
import { recalledEvidence } from './retrieval-context';
import { buildPrompt } from './context';
import { deviceContext, isDeviceClockQuestion, clockAnswer, type DeviceContext } from './device-context';
import { needsCurrentInformation, wantsSources, searchInternet, readSourceArticle, safeSourceURL, type SearchMode, type SearchEvidence } from './search';
interface AnswerOptions {
  mode: SearchMode; signal: AbortSignal;
  onUpdate(text: string, evidence?: SearchEvidence): void;
  onActivity(message: string): void;
  clock?: () => DeviceContext;
  search?: typeof searchInternet;
  readArticle?: typeof readSourceArticle;
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
  let evidence: SearchEvidence | undefined = recalledEvidence(conversation);
  const recalled = !!evidence;
  const suppliedURL = /\b(?:read|summarize|article)\b/i.test(question) ? question.match(/https?:\/\/[^\s<>]+/i)?.[0].replace(/[).,;!?]+$/, '') : undefined;
  if (suppliedURL && safeSourceURL(suppliedURL) && options.mode !== 'off') {
    options.onActivity('Reading the supplied article…');
    const source = await (options.readArticle ?? readSourceArticle)({title:new URL(suppliedURL).hostname + new URL(suppliedURL).pathname,url:suppliedURL,excerpt:'Article URL supplied by the user.'},options.signal);
    options.signal.throwIfAborted();
    evidence = {query:question,provider:'Public article',scope:'web',fetchedAt:clock.isoTime,timeZone:clock.timeZone,sources:[source]};
  }
  if (current && !evidence) {
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
  if (recalled && evidence && /article|story|piece|interview|transcript|paywall|what did it say|summarize it/i.test(question) && !evidence.sources[0].article && options.mode !== 'off') {
    options.onActivity('Reading the previously used source…');
    const source = await (options.readArticle ?? readSourceArticle)(evidence.sources[0],options.signal);
    options.signal.throwIfAborted();
    evidence = {...evidence,sources:[source,...evidence.sources.slice(1)]};
  }
  options.onActivity(evidence ? 'Local AI is summarizing retrieved sources…' : 'Local AI is replying…');
  const showSources = wantsSources(question);

  const text = await provider.generate({ prompt, device: clock, evidence, showSources, recalled }, text => options.onUpdate(text, evidence), options.signal);
  options.signal.throwIfAborted();
  return { text, evidence, retryable: false };
}
