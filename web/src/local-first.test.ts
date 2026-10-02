import { describe, it, expect, vi } from 'vitest';
import { deviceContext, isDeviceClockQuestion, type DeviceContext } from './device-context';
import { answerConversation } from './chat-service';
import { needsCurrentInformation, wantsSources, searchInternet, type SearchEvidence } from './search';
import type { ChatProvider, ChatRequest } from './provider';
import type { Conversation } from './types';
const clock = () => deviceContext(new Date('2026-10-01T21:00:00Z'), 'America/Chicago');
const conversation = (text: string): Conversation => ({ id: 'c', title: 'test', messages: [{ id: 'm', role: 'user', text, createdAt: '' }] });
const evidence: SearchEvidence = { query: 'Tulsa news today', provider: 'fixture RSS', scope: 'today', fetchedAt: '2026-10-01T21:00:00Z', timeZone: 'America/Chicago', sources: [{ title: 'Test headline', excerpt: 'Fixture: a Tulsa library opens a reading room.', url: 'https://example.org/news', publishedAt: '2026-10-01T18:00:00Z' }] };
function setup(reply = 'A local answer') {
  const generate = vi.fn(async (_request: ChatRequest) => reply);
  const provider = { generate } as unknown as ChatProvider;
  const search = vi.fn(async (_query: string, _clock: DeviceContext, _signal: AbortSignal) => evidence);
  const onUpdate = vi.fn(); const onActivity = vi.fn();
  const options = { mode: 'auto' as const, clock, search, onUpdate, onActivity, signal: new AbortController().signal };
  return { provider, generate, search, onUpdate, options };
}
describe('offline device clock', () => {
  it('uses the local date across UTC midnight and DST transitions', () => {
    expect(deviceContext(new Date('2026-10-02T02:00:00Z'), 'America/Chicago')).toMatchObject({ localDate: '2026-10-01', localTime: '21:00:00', weekday: 'Thursday', utcOffset: 'GMT-05:00' });
    expect(deviceContext(new Date('2026-03-08T07:59:00Z'), 'America/Chicago').utcOffset).toBe('GMT-06:00');
    expect(deviceContext(new Date('2026-03-08T08:00:00Z'), 'America/Chicago').localTime).toBe('03:00:00');
  });
  it('recognizes direct clock questions but not event schedules', () => {
    for (const q of ["What's today's date?", 'What time is it?', 'What timezone am I in?', 'What day is today?', 'What is the current date and time?']) expect(isDeviceClockQuestion(q)).toBe(true);
    expect(isDeviceClockQuestion('What time does the concert start today?')).toBe(false);
  });
  it('answers without network or model inference even in always-search mode', async () => {
    const s = setup(); const result = await answerConversation(conversation('What time is it?'), [], s.provider, { ...s.options, mode: 'always' });
    expect(result.text).toContain('2026-10-01'); expect(result.text).toContain('16:00:00'); expect(result.text).toContain('America/Chicago');
    expect(s.generate).not.toHaveBeenCalled(); expect(s.search).not.toHaveBeenCalled();
  });
});

describe('local-first routing and natural replies', () => {
  it('answers ordinary questions through the local model in every enabled mode', async () => {
    for (const question of ['What is the capital of Oklahoma?', 'If I drive 180 miles at 60 mph, how long will it take?', 'Who is Shakespeare?', 'Compare cats and dogs', 'Research solar panel efficiency', 'How does weather forecasting work?', 'What is the stock market?', 'Tell me a joke', 'What is electric current?', 'Help me describe my current mood', 'What is price elasticity?', 'Explain weather forecasting']) {
      expect(needsCurrentInformation(question),question).toBe(false);
      for (const mode of ['auto','always','web','off'] as const) {
        const s = setup(); await answerConversation(conversation(question),[],s.provider,{...s.options,mode});
        expect(s.search).not.toHaveBeenCalled(); expect(s.generate.mock.calls[0][0].evidence).toBeUndefined();
      }
    }
  });
  it('searches live questions and explicit search requests', () => {
    for (const q of ['What is the weather in Tulsa right now?', 'Tulsa news today', 'Latest Firefox version', 'Who is the mayor of Tulsa?', 'Search for hiking trails', 'Look up the capital of Oklahoma', 'MacBook Air current price']) expect(needsCurrentInformation(q),q).toBe(true);
    expect(needsCurrentInformation('What was the weather in Tulsa in 1900?')).toBe(false);
  });
  it('streams normal retrieved prose without validation gates, warnings or sources by default', async () => {
    const s = setup('Tulsa is at 70°F, feeling like 74°F.');
    const result = await answerConversation(conversation('What is the weather in Tulsa right now?'),[],s.provider,s.options);
    expect(result.text).toBe('Tulsa is at 70°F, feeling like 74°F.'); expect(result.evidence).toBeUndefined(); expect(result.retryable).toBe(false);
    expect(s.generate).toHaveBeenCalledTimes(1); expect(s.generate.mock.calls[0][0]).toMatchObject({evidence,showSources:false}); expect(s.generate.mock.calls[0][0].responseKind).toBeUndefined();
  });
  it('only exposes sources when requested and keeps notes/history out of search', async () => {
    const s = setup('A Tulsa library opens a reading room. [1]');
    const c=conversation('Tulsa news today. Show sources.'); c.messages.unshift({id:'old',role:'assistant',text:'Private earlier turn',createdAt:''});
    const result=await answerConversation(c,[{id:'secret',text:'Private memory'}],s.provider,s.options);
    expect(s.search.mock.calls[0][0]).toBe('Tulsa news today. Show sources.'); expect(result.evidence).toEqual(evidence); expect(s.generate.mock.calls[0][0].showSources).toBe(true);
    expect(wantsSources('Give me sources')).toBe(true); expect(wantsSources('What is the weather?')).toBe(false);
  });
  it('does not fabricate live data when search is unavailable', async () => {
    const s=setup(); s.search.mockRejectedValueOnce(new Error('Offline'));
    const result=await answerConversation(conversation('Tulsa weather right now'),[],s.provider,s.options);
    expect(result.text).toContain("couldn't retrieve live information"); expect(result.text).not.toMatch(/validat|publication/); expect(s.generate).not.toHaveBeenCalled();
  });
  it('preserves retrieval cancellation', async () => {
    const s=setup(); const abort=new AbortController();
    s.search.mockImplementationOnce(async()=>{abort.abort(); throw new DOMException('Stopped','AbortError');});
    await expect(answerConversation(conversation('Tulsa news today'),[],s.provider,{...s.options,signal:abort.signal})).rejects.toMatchObject({name:'AbortError'}); expect(s.onUpdate).not.toHaveBeenCalled();
  });
});
