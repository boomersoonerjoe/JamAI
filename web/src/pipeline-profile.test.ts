import { expect, it } from 'vitest';
import { answerConversation } from './chat-service';
import { OllamaChatProvider, MAC_MODEL } from './ollama-provider';
import { buildPrompt } from './context';
import { deviceContext } from './device-context';

const env = (globalThis as unknown as { process?: { env: Record<string, string> } }).process?.env;
it.skipIf(!env?.NHOMEAI_PROFILE_PHASE)('profiles cold and warm end-to-end local and Tulsa weather requests', async () => {
  for (const question of ['What is the capital of Oklahoma?', 'What is the weather in Tulsa, OK right now?']) {
    for (const state of ['cold', 'warm']) {
      if (state === 'cold') {
        await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MAC_MODEL, keep_alive: 0 }) });
      }
      const calls: Record<string, unknown>[] = [], pending: Promise<void>[] = [];
      const start = performance.now();
      const provider = new OllamaChatProvider(async (input, init) => {
        const began = performance.now();
        const payload = init?.body ? JSON.parse(String(init.body)) : undefined;
        const row: Record<string, unknown> = { endpoint: String(input), startMs: began-start, context: payload?.options?.num_ctx, promptBytes: payload ? new TextEncoder().encode(JSON.stringify(payload.messages ?? payload.prompt ?? '')).length : 0 };
        calls.push(row);
        const response = await fetch(input, init);
        row.headersMs = performance.now()-began;
        if (payload?.stream) pending.push((async () => {
          const reader = response.clone().body!.getReader();
          const decoder = new TextDecoder(); let buffer = '';
          const consume = (line: string) => {
            if (!line.trim()) return;
            const chunk = JSON.parse(line);
            if ((chunk.message?.content || chunk.response) && row.firstModelTokenMs === undefined) row.firstModelTokenMs = performance.now()-start;
            if (chunk.done) Object.assign(row, { totalMs: performance.now()-began, loadMs: chunk.load_duration / 1e6, promptEvalMs: chunk.prompt_eval_duration / 1e6, promptTokens: chunk.prompt_eval_count, decodeMs: chunk.eval_duration / 1e6, outputTokens: chunk.eval_count });
          };
          while (true) { const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done }); let n; while ((n=buffer.indexOf('\n'))>=0) { consume(buffer.slice(0,n)); buffer=buffer.slice(n+1); } if (chunk.done) { consume(buffer); break; } }
        })());
        else row.totalMs = performance.now()-began;
        return response;
      });
      await provider.prepare(() => {});
      const prepareMs = performance.now()-start;
      const stages: { stage: string; atMs: number }[] = [];
      let firstVisibleMs: number | undefined;
      const conversation = { id: 'profile', title: question, messages: [{ id: 'q', role: 'user' as const, text: question, createdAt: '' }] };
      const clock = deviceContext();
      const contextStart=performance.now(); buildPrompt(conversation, []); const contextMs=performance.now()-contextStart;
      const result = await answerConversation(conversation, [], provider, { mode: 'auto', clock: () => clock, signal: AbortSignal.timeout(150000),
        onActivity(stage) { stages.push({stage,atMs:performance.now()-start}); },
        onUpdate(text) { if (text.trim()) firstVisibleMs ??= performance.now()-start; },
        search: async (query, device, signal, kind, coordinates, plan) => {
          const began=performance.now();
          const response=await fetch('http://127.0.0.1:4173/api/search',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({query,kind:kind ?? (/weather/i.test(query)?'web':'news'),day:device.localDate,timeZone:device.timeZone,today:false,coordinates,...(plan?{searchQueries:plan.queries,searchTerms:plan.terms,retrievalIntent:plan.intent}: {})})});
          const data=await response.json(); calls.push({endpoint:'search/weather',startMs:began-start,totalMs:performance.now()-began});
          if(!response.ok) throw new Error(JSON.stringify(data)); return data;
        },
      });
      const totalMs=performance.now()-start;
      await Promise.all(pending);
      expect(result.retryable).toBe(false);
      expect(result.text).toMatch(/capital/i.test(question)?/Oklahoma City/:/°[FC]/);
      console.log('PIPELINE_PROFILE '+JSON.stringify({phase:env!.NHOMEAI_PROFILE_PHASE,question,state,prepareMs,contextMs,firstVisibleMs,totalMs,stages,calls,answer:result.text}));
    }
  }
}, 650000);
