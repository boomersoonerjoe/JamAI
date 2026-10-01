import {Conversation,MemoryNote} from "./types";
const enc=new TextEncoder();
function bytes(s:string){return enc.encode(s).length}
function prefix(s:string,limit:number){let out="";for(const c of s){if(bytes(out+c)>limit)break;out+=c}return out}
export function buildPrompt(conversation:Conversation,memories:MemoryNote[]){
 const latest=conversation.messages.at(-1); if(!latest||latest.role!=="user") throw new Error("No user message to answer.");
 if(bytes(latest.text)>1200) throw new Error("Send a shorter message (up to 1,200 UTF-8 bytes).");
 const notes=prefix(memories.map(x=>x.text).join("\n"),500); const recent:string[]=[]; let budget=700;
 for(const m of conversation.messages.slice(0,-1).reverse()){const line=`${m.role}: ${m.text}\n`;if(bytes(line)>budget)break;recent.unshift(line);budget-=bytes(line)}
 return `Saved memory notes (may be incomplete):\n${notes}\nRecent conversation excerpt (older messages may be omitted):\n${recent.join("")}\nCurrent user message:\n${latest.text}\nRespond to the current user message.`;
}
