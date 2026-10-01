import type { DeviceContext } from './device-context';
export type SearchMode = 'auto' | 'always' | 'web' | 'off';
export interface SearchSource { title: string; url: string; excerpt: string; publisher?: string; publishedAt?: string }
export interface SearchEvidence {
  query: string; provider: string; fetchedAt: string; timeZone: string;
  scope: 'today' | 'recent' | 'web' | 'weather'; sources: SearchSource[];
}
export function needsCurrentInformation(text: string) {
  return /\b(news|headlines?|breaking|weather|forecast|latest|current|recent|live|up[- ]to[- ]date|stock|stocks|price|prices|scores?|exchange rate|opening hours|release date|availability|products?|buy|buying|shopping|cost|costs|deals?|research|compare|comparison|reviews?|recommend(?:ations?)?|current events|laptops?|smartphones?|tablets?|macbook|iphone)\b|\b(search|browse|look up|google)\b|\b(how much|where can i buy|who (?:is|are)|when (?:is|does)|is .+ (?:open|available|released))\b|\b(?:today|tonight|this week|this month|this year|right now)\b.*\b(happen|happening|happened|happenings|in|at)\b/i.test(text);
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
