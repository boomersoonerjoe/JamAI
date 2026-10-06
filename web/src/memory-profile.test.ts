import { expect, it } from 'vitest';
import { buildPrompt } from './context';
const enabled = (globalThis as unknown as { process?: { env: Record<string,string> } }).process?.env.NHOMEAI_PROFILE_PHASE;
it.skipIf(!enabled)('profiles memory indexing and bounded context with 1000 synthetic notes', () => {
  const notes = Array.from({length:1000},(_,i)=>({id:String(i),text:`My project ${i} is about synthetic gardening notes number ${i}.`}));
  const conversation={id:'profile',title:'Memory profile',messages:[{id:'q',role:'user' as const,text:'What do you remember about my gardening project 500?',createdAt:''}]};
  const start=performance.now(); const prompt=buildPrompt(conversation,notes); const coldMs=performance.now()-start;
  const samples=Array.from({length:100},()=>{const start=performance.now();buildPrompt(conversation,notes);return performance.now()-start;}).sort((a,b)=>a-b);
  expect(prompt).toContain('500');
  console.log(JSON.stringify({memoryNotes:notes.length,indexAndContextColdMs:coldMs,contextWarmMedianMs:samples[50],contextWarmP95Ms:samples[95],promptBytes:new TextEncoder().encode(prompt).length}));
});
