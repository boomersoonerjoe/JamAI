import { describe, it, expect, vi } from 'vitest';
import { deviceContext, isDeviceClockQuestion, type DeviceContext } from './device-context';
import { answerConversation, validateGroundedAnswer } from './chat-service';
import { needsCurrentInformation, searchInternet, type SearchEvidence } from './search';
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
describe('local-first grounded answers', () => {
  it('keeps ordinary offline chat local and supplies fresh device context', async () => {
    const s = setup(); await answerConversation(conversation('Write a poem about a tree'), [], s.provider, s.options);
    expect(s.search).not.toHaveBeenCalled(); expect(s.generate.mock.calls[0][0]).toMatchObject({ device: clock() });
  });
  it('routes current questions while preserving normal personal conversation', () => {
    for (const q of ['Tulsa news today', 'Latest Firefox version', 'Who is the mayor of Tulsa?', 'Weather in Tulsa tomorrow', 'Search for hiking trails', 'Research solar panel efficiency', 'Compare latest budget laptops', 'MacBook Air current price', 'Current events in Oklahoma']) expect(needsCurrentInformation(q)).toBe(true);
    expect(needsCurrentInformation('Help me plan my day today')).toBe(false);
  });
  it('sends only the current query to search, keeps notes/history local and extracts exact evidence', async () => {
    const s = setup(JSON.stringify({sentences:[{text:'A headline reports a Tulsa library opens a reading room.',source:1,quote:evidence.sources[0].excerpt}],invented:'A fabricated event happened'}));
    const c = conversation('Tulsa news today'); c.messages.unshift({ id: 'old', role: 'assistant', text: 'Private earlier turn', createdAt: '' });
    const result = await answerConversation(c, [{ id: 'secret', text: 'Private memory' }], s.provider, s.options);
    expect(s.search.mock.calls[0][0]).toBe('Tulsa news today');
    expect(result.text).toContain('A headline reports a Tulsa library opens a reading room.'); expect(result.text).not.toContain('fabricated event');
    expect(s.generate.mock.calls[0][0]).toMatchObject({ responseKind: 'grounded-answer', evidence });
    expect(s.onUpdate).toHaveBeenCalledTimes(1);
  });
  it('does not ask a model for current facts when search is offline, disabled or empty', async () => {
    for (const failure of ['offline', 'off', 'empty']) {
      const s = setup();
      if (failure === 'offline') s.search.mockRejectedValueOnce(new Error('Offline'));
      if (failure === 'empty') s.search.mockResolvedValueOnce({ ...evidence, sources: [] });
      const result = await answerConversation(conversation('Tulsa news today'), [], s.provider, { ...s.options, mode: failure === 'off' ? 'off' : 'auto' });
      expect(result.text).toContain("can't verify"); expect(result.retryable).toBe(true); expect(s.generate).not.toHaveBeenCalled();
      if (failure === 'off') expect(s.search).not.toHaveBeenCalled();
    }
  });
  it('rejects made-up source IDs, malformed summaries and repeated IDs', async () => {
    for (const reply of ['{"sentences":[{"text":"News","source":99,"quote":"unknown quote"}]}', 'A made-up news story', '{"sentences":[{"text":"News","source":1,"quote":"invented quotation"}]}']) {
      const s = setup(reply); const result = await answerConversation(conversation('Tulsa news today'), [], s.provider, s.options);
      expect(result.text).toContain("couldn't validate"); expect(result.text).not.toContain('made-up news'); expect(result.retryable).toBe(true);
    }
  });
  it('reports insufficient evidence and does not invent an answer', async () => {
    const s = setup('{"sentences":[]}');
    expect((await answerConversation(conversation('Tulsa news today'), [], s.provider, s.options)).text).toContain('enough information');
  });
  it('cancels retrieval without saving an offline-failure answer', async () => {
    const s = setup(); const abort = new AbortController();
    s.search.mockImplementationOnce(async () => { abort.abort(); throw new DOMException('Stopped', 'AbortError'); });
    await expect(answerConversation(conversation('Tulsa news today'), [], s.provider, { ...s.options, signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(s.onUpdate).not.toHaveBeenCalled(); expect(s.generate).not.toHaveBeenCalled();
  });
});

it('can explicitly use general web for news without sending notes or history', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(evidence)));
  vi.stubGlobal('fetch', fetcher);
  try {
    await searchInternet('Tulsa news today',clock(),new AbortController().signal,'web');
    const body = JSON.parse((fetcher.mock.calls as unknown as [string, RequestInit][])[0][1].body as string);
    expect(body).toEqual({query:'Tulsa news today',kind:'web',today:true,day:'2026-10-01',timeZone:'America/Chicago'});
  } finally { vi.unstubAllGlobals(); }
});

it('rejects invented numbers, fake quotes and model-authored links in conversational answers', () => {
  const source = { ...evidence, scope:'web' as const, sources: [{...evidence.sources[0],excerpt:'Tulsa temperature is 70°F and wind is 5 mph.'}] };
  const answer = (text: string,quote = source.sources[0].excerpt) => JSON.stringify({sentences:[{text,source:1,quote}]});
  expect(validateGroundedAnswer(answer('Tulsa is at 70°F.'),source)).toHaveLength(1);
  expect(() => validateGroundedAnswer(answer('Tulsa is at 95°F.'),source)).toThrow('numerical');
  expect(() => validateGroundedAnswer(answer('Tulsa is at 70°F.','Tulsa is at 70°F.'),source)).toThrow();
  expect(() => validateGroundedAnswer(answer('Visit https://fake.example'),source)).toThrow();
});

it('does not turn scheduled news into completed events or add unsupported names', () => {
  const e = {...evidence,sources:[{...evidence.sources[0],title:'Charlotte Travels to Tulsa for Friday Match',excerpt:'Charlotte Travels to Tulsa for Friday Match'}]};
  const answer = (text:string) => JSON.stringify({sentences:[{text,source:1,quote:e.sources[0].excerpt}]});
  expect(validateGroundedAnswer(answer('A headline covers Charlotte traveling to Tulsa for a Friday match.'),e)).toHaveLength(1);
  expect(() => validateGroundedAnswer(answer('A headline reports Charlotte traveled to Tulsa today.'),e)).toThrow();
  expect(() => validateGroundedAnswer(answer('A headline mentions Donald Trump.'),e)).toThrow();
});

it('corrects a citation only when its exact quote uniquely matches another retrieved source', () => {
  const e = {...evidence,scope:'web' as const,sources:[{...evidence.sources[0],excerpt:'Tulsa temperature is 70°F.'},{...evidence.sources[0],excerpt:'Oklahoma City temperature is 71°F.'}]};
  const raw = JSON.stringify({sentences:[{text:'Oklahoma City is at 71°F.',source:1,quote:e.sources[1].excerpt}]});
  expect(validateGroundedAnswer(raw,e)[0].source).toBe(2);
  expect(() => validateGroundedAnswer(raw,{...e,sources:[e.sources[0],e.sources[1],e.sources[1]]})).toThrow('quote');
});

it('retains a supported sentence while discarding an unsupported companion after repair', async () => {
  const s = setup(JSON.stringify({sentences:[{text:'A headline reports a Tulsa library opens a reading room.',source:1,quote:evidence.sources[0].excerpt},{text:'A headline reports Donald Trump arrived today.',source:1,quote:evidence.sources[0].excerpt}]}));
  const result = await answerConversation(conversation('Tulsa news today'),[],s.provider,s.options);
  expect(result.retryable).toBe(false); expect(result.text).toContain('reading room'); expect(result.text).not.toContain('Donald'); expect(s.generate).toHaveBeenCalledTimes(2);
});
