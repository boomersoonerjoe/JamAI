import type { DeviceContext } from './device-context';
export type SearchMode = 'auto' | 'always' | 'web' | 'off';
export interface SearchSource { title: string; url: string; excerpt: string; publisher?: string; publishedAt?: string; article?: {status:'retrieved'|'restricted'|'unavailable'; text?:string; fetchedAt:string; url:string} }
export interface SearchEvidence {
  query: string; provider: string; fetchedAt: string; timeZone: string;
  scope: 'today' | 'recent' | 'web' | 'weather'; sources: SearchSource[];
}
export function wantsSources(text: string) {
  return /\b(sources?|citations?|references?)\b|\b(?:show|include|give|provide)\b.*\blinks?\b|\bcite\b/i.test(text);
}
export function needsCurrentInformation(text: string) {
  const explicit = /\b(search|browse|google)\b|\blook\s+up\b/i.test(text);
  const liveTopic = /\b(news|headlines?|breaking|weather|forecast|stock price|stock market|exchange rates?|opening hours|availability|current events)\b/i.test(text);
  const changingQuestion = /\b(?:latest|up[- ]to[- ]date)\b|\b(?:current|recent|live)\b.*\b(?:versions?|releases?|events?|conditions?|temperatures?|president|mayor|governor|ceo|results?|status|prices?)\b|\b(?:prices?|scores?|deals?)\b|\bwho (?:is|are)\b.*\b(?:president|mayor|governor|prime minister|ceo)\b|\bis .+ (?:open|available|released)\b/i.test(text);
  const timeSensitive = /\b(today|tonight|this week|this month|this year|right now)\b/i.test(text) && /\b(happen|happening|happened|events?|cost|released|release|open|temperature|rain)\b/i.test(text);
  const historical = /\b(?:history|historical|in \d{4}|was|were)\b/i.test(text);
  const conceptual = /\b(?:what (?:is|are)|how (?:does|do)|explain|define)\b.*\b(?:weather|forecast|stock market|exchange rate|news|price elasticity)\b/i.test(text) && !/\b(?:in|for|today|now|current|latest|tomorrow)\b/i.test(text);
  return explicit || (!historical && !conceptual && (liveTopic || changingQuestion || timeSensitive));
}
export function safeSourceURL(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname);
  } catch { return false; }
}
export async function searchInternet(query: string, clock: DeviceContext, signal: AbortSignal, kindOverride?: 'web' | 'news'): Promise<SearchEvidence> {
  if (globalThis.navigator?.onLine === false) throw new Error('Your device reports it is offline.');
  const kind = kindOverride ?? (/\b(news|headlines?|breaking)\b/i.test(query) ? 'news' : 'web');
  const today = /\b(today|tonight|this morning)\b/i.test(query);
  const response = await fetch('/api/search', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ query, kind, today, day: clock.localDate, timeZone: clock.timeZone }),
  });
  const evidence = await response.json() as SearchEvidence & { error?: string };
  if (!response.ok) throw new Error(evidence.error || `Search returned HTTP ${response.status}.`);
  if (!Array.isArray(evidence.sources) || !evidence.sources.length || evidence.sources.some(s => !safeSourceURL(s.url))) throw new Error('Search returned no usable sources.');
  return evidence;
}

export async function readSourceArticle(source: SearchSource, signal: AbortSignal): Promise<SearchSource> {
  if (source.article || !safeSourceURL(source.url)) return source;
  try {
    const response = await fetch('/api/article',{method:'POST',signal,headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({url:source.url})});
    if (!response.ok) throw new Error('Article unavailable');
    const article = await response.json() as NonNullable<SearchSource['article']>;
    if (!['retrieved','restricted','unavailable'].includes(article.status) || !safeSourceURL(article.url)) throw new Error('Invalid article response');
    return {...source,article:{...article,text:article.text?.slice(0,12000)}};
  } catch {signal.throwIfAborted();return {...source,article:{status:'unavailable',url:source.url,fetchedAt:new Date().toISOString()}};}
}
