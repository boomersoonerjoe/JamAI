import {it,expect,vi} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {answerConversation} from '../src/chat-service';
import {deviceContext} from '../src/device-context';
import {OllamaChatProvider} from '../src/ollama-provider';
import {searchInternet} from '../src/search';
const input=process.env.NHOMEAI_CONVERSATIONS_FILE;
const cases=input?JSON.parse(await readFile(input,'utf8')):[];
it.skipIf(!input)('runs multi-turn conversations through production chat and the local search API',async()=>{
 const nativeFetch=globalThis.fetch;
 vi.stubGlobal('fetch',(url,options)=>nativeFetch(typeof url==='string'&&url.startsWith('/')?`http://127.0.0.1:4173${url}`:url,options));
 const provider=new OllamaChatProvider();await provider.prepare(()=>{});const reports=[];
 try {
 for(const entry of cases) {
  const conversation={id:crypto.randomUUID(),title:'Live conversation validation',messages:[]};
  for(const question of entry.turns) {
   const clock=deviceContext(new Date(),'America/Chicago'),calls=[],timings=[];const started=performance.now();
   conversation.messages.push({id:crypto.randomUUID(),role:'user',text:question,createdAt:clock.isoTime});
   const generate=provider.generate.bind(provider);let received,plan;const modelAnswers=[];
   provider.generate=async(request,...args)=>{const start=performance.now();if(request.evidence)received=request.evidence;try {const text=await generate(request,...args);if(request.responseKind==='retrieval-plan')plan=text;else modelAnswers.push(text);return text;}finally{timings.push({stage:request.responseKind||'answer',ms:Math.round(performance.now()-start)});}};
   let result;
   try {result=await answerConversation(conversation,[],provider,{mode:entry.mode||'auto',clock:()=>clock,signal:AbortSignal.timeout(120000),onUpdate(){},onActivity(){},search:async(...args)=>{const start=performance.now();calls.push({query:args[0],plan:args[5]});try{return await searchInternet(...args);}finally{timings.push({stage:'retrieval',ms:Math.round(performance.now()-start)});}}});}
   catch(error){result={text:'',retryable:true,error:String(error)};}
   finally {provider.generate=generate;}
   conversation.messages.push({id:crypto.randomUUID(),role:'assistant',text:result.text,createdAt:clock.isoTime,...(result.evidence?{evidence:result.evidence}:{})});
   reports.push({name:entry.name,question,answer:result.text,calls,plan,modelAnswers,evidence:result.evidence,retryable:result.retryable,error:result.error,received:!!received,elapsedMs:Math.round(performance.now()-started),timings});
   if(process.env.NHOMEAI_REPORT_FILE)await writeFile(process.env.NHOMEAI_REPORT_FILE,JSON.stringify(reports,null,2));
  }
 }
 } finally {vi.unstubAllGlobals();}
 if(process.env.NHOMEAI_ASSERT_LIVE!=='0')for(const report of reports){expect(report.error,report.question).toBeUndefined();expect(report.retryable,report.question).toBe(false);expect(report.answer,report.question).not.toMatch(/internet.{0,20}unavailable|when internet search is available|cannot browse/i);}
},1200000);
