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
    // Stage the grounded prose until all supporting quotes/citations have passed validation.
    let raw = await provider.generate({ prompt, device: clock, evidence, responseKind: 'grounded-answer' }, () => {}, options.signal);
    options.signal.throwIfAborted();
    let sentences: {text: string; source: number; quote: string}[];
    try { sentences = validateGroundedAnswer(raw, evidence); }
    catch (firstError) {
      options.signal.throwIfAborted();
      raw = await provider.generate({prompt: `${prompt}\nYour previous draft did not pass evidence validation: ${firstError instanceof Error ? firstError.message : 'unsupported quote'}. Repair the answer. Keep it short; copy source wording closely and add no missing details.`,device:clock,evidence,responseKind:'grounded-answer'},()=>{},options.signal);
      options.signal.throwIfAborted();
      try { sentences = validateGroundedAnswer(raw,evidence); } catch {
        // Retain individually supported sentences; a bad companion must never be published.
        sentences = [];
        try {
          const draft = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
          if (Array.isArray(draft.sentences) && draft.sentences.length <= 3) {
            for (const sentence of draft.sentences) {
              try { sentences.push(...validateGroundedAnswer(JSON.stringify({sentences:[sentence]}),evidence)); } catch { /* Discard unsupported prose. */ }
            }
          }
        } catch { /* Invalid JSON has no supported sentences. */ }
        if (!sentences.length) {
          const text = "I found sources, but couldn't validate a supported summary. I won't present unverified details. You can inspect the sources below or retry.";
          options.onUpdate(text, evidence); return { text, evidence, retryable: true };
        }
      }
    }
    const caveat = evidence.scope === 'weather' ? 'This is a weather-model estimate, not a station observation. The resolved place and data time are in the retrieved evidence.' : evidence.scope === 'web' ? 'These search snippets may be incomplete or outdated; current prices, availability and publication dates are not independently verified.' : `This is based on retrieved headlines${evidence.scope === 'today' ? ` published on ${clock.localDate} in ${clock.timeZone}` : ''}, not full articles or complete coverage.`;
    const text = sentences.length ? `${sentences.map(s => `${s.text} [${s.source}]`).join(' ')}\n\n${caveat}` : "I found sources, but they don't contain enough information to answer that question reliably. I won't guess; the source links are below.";
    options.onUpdate(text, evidence); return { text, evidence, retryable: false };

  }
  const text = await provider.generate({ prompt, device: clock }, text => options.onUpdate(text), options.signal);
  return { text, retryable: false };
}

export function validateGroundedAnswer(raw: string, evidence: SearchEvidence): {text: string; source: number; quote: string}[] {
  const data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as {sentences?: unknown};
  if (!Array.isArray(data.sentences) || data.sentences.length > 3) throw new Error('Invalid answer shape');
  return data.sentences.map(s => {
    if (!s || typeof s.text !== 'string' || !s.text.trim() || s.text.length > 700 || /https?:|\[\d+\]/i.test(s.text) || !Number.isInteger(s.source) || s.source < 1 || s.source > evidence.sources.length || typeof s.quote !== 'string' || s.quote.trim().length < 12) throw new Error('Unsupported source or quote');
    let sourceNumber = s.source;
    if (!evidence.sources[sourceNumber-1].excerpt.includes(s.quote)) {
      const matches = evidence.sources.flatMap((source,index) => source.excerpt.includes(s.quote) ? [index+1] : []);
      if (matches.length !== 1) throw new Error('Unsupported source quote');
      sourceNumber = matches[0];
    }
    if (evidence.scope === 'today' || evidence.scope === 'recent') {
      const connectors = new Set('a an the headline headlines mentions covers reports that this is are as in on at of for to and or with from its his her their it has have had into about according says report mention covering reporting mentioned reported'.split(' '));
      const quoteWords: string[] = s.quote.toLowerCase().match(/[a-z]+/g) || [];
      for (const word of s.text.toLowerCase().match(/[a-z]+/g) || []) {
        if (!connectors.has(word) && !quoteWords.includes(word) && !(word.length >= 4 && quoteWords.some(w => w.length >= 4 && w.slice(0,4) === word.slice(0,4)))) throw new Error(`Unsupported news wording: ${word}`);
      }
      if (!/headline/i.test(s.text)) throw new Error('Missing headline attribution');
      for (const word of s.text.match(/\b(?:held|traveled|occurred|happened|opened|announced|yesterday|today|tonight)\b/gi) || []) {
        if (!s.quote.toLowerCase().includes(word.toLowerCase())) throw new Error('Unsupported event tense or timing');
      }
    }
    const allowedFraming = new Set(['The','A','I','This','These','Those','According','One','Here','It','For','From','In','There','However','Based','Retrieved','Current','Search','While','Although']);
    const support = `${s.quote} ${evidence.sources[sourceNumber-1].title} ${evidence.sources[sourceNumber-1].publisher || ''}`.toLowerCase();
    for (const name of s.text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g) || []) {
      if (!allowedFraming.has(name) && !support.includes(name.toLowerCase())) throw new Error('Unsupported name');
    }
    const numbers: string[] = s.text.match(/-?\d+(?:\.\d+)?/g) || [];
    const supported: string[] = s.quote.match(/-?\d+(?:\.\d+)?/g) || [];
    if (numbers.some(n => !supported.includes(n))) throw new Error('Unsupported numerical claim');
    return {text:s.text.trim(),source:sourceNumber,quote:s.quote};
  });
}
