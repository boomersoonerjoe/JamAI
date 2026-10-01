import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { loadData, saveData } from './storage';
import type { AppData, Conversation, Message } from './types';
import { buildPrompt } from './context';
import type { ChatProvider, ProviderStatus } from './provider';
import { LocalChatProvider } from './local-provider';
import { OllamaChatProvider } from './ollama-provider';

const id = () => crypto.randomUUID();
const msg = (text: string, role: 'user' | 'assistant'): Message => ({ id: id(), text, role, createdAt: new Date().toISOString() });
function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const dataRef = useRef(data);
  const [active, setActive] = useState<string>();
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<ProviderStatus>({ phase: 'idle', message: 'Connect or load the selected runtime to start local chat.' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<Conversation>();
  const controller = useRef<AbortController | null>(null);
  const [providerID, setProviderID] = useState(() => /Macintosh|Windows|X11|Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent) ? 'ollama' : 'webllm');
  const provider: ChatProvider = useMemo(() => providerID === 'ollama' ? new OllamaChatProvider() : new LocalChatProvider(), [providerID]);
  const current = data.conversations.find(c => c.id === active);
  function update(next: AppData) {
    saveData(next);
    dataRef.current = next;
    setData(next);
  }
  function replace(c: Conversation) {
    update({ ...dataRef.current, conversations: dataRef.current.conversations.map(x => x.id === c.id ? c : x) });
  }
  function create() {
    const c: Conversation = { id: id(), title: 'New conversation', messages: [] };
    update({ ...dataRef.current, conversations: [c, ...dataRef.current.conversations] });
    setActive(c.id); setRetry(undefined); setError('');
  }
  async function load() {
    setError('');
    try { await provider.prepare(setStatus); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  async function answer(c: Conversation) {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(''); setRetry(undefined);
    const response = msg('', 'assistant');
    try {
      const prompt = buildPrompt(c, dataRef.current.memories);
      replace(c);
      const publish = (text: string) => replace({ ...c, messages: [...c.messages, { ...response, text }] });
      const text = await provider.generate({ prompt }, publish, abort.signal);
      if (!text.trim()) throw new Error('The model returned an empty response. Try again.');
      publish(text);
    } catch (e) {
      setError(abort.signal.aborted ? 'Response stopped. You can retry.' : e instanceof Error ? e.message : String(e));
      setRetry(c);
    } finally { controller.current = null; setBusy(false); }
  }
  function send() {
    if (!current || !draft.trim() || busy || status.phase !== 'ready') return;
    const text = draft.trim();
    const c = { ...current, messages: [...current.messages, msg(text, 'user')] };
    if (c.messages.length === 1) c.title = text.slice(0, 48);
    try { buildPrompt(c, dataRef.current.memories); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return; }
    setDraft(''); void answer(c);
  }
  return <main>
    <header><h1>NhomeAI</h1><small>Private cross-platform AI</small></header>
    <section className="model">
      <label>Chat runtime <select aria-label="Chat runtime" value={providerID} disabled={busy || status.phase === 'loading'} onChange={e => {
        setProviderID(e.target.value); setStatus({ phase: 'idle', message: 'Connect or load the selected runtime to start chat.' }); setError('');
      }}><option value="ollama">Local Ollama (Mac / PC)</option><option value="webllm">On-device browser (WebGPU)</option></select></label>
      <p><strong>{provider.name}</strong></p>
      {providerID === 'ollama' ? <p>Install Ollama and Qwen3.5 4B once, then connect. Chats stay on this computer and work offline. Ollama must be running at 127.0.0.1:11434. No cloud fallback.</p> : <p>First load downloads model assets from Hugging Face and the WebLLM runtime CDN, then caches them in this browser. Chats run on this device. Allow roughly 1 GB or more of free storage and memory; keep the app open while loading.</p>}
      <div role="status" aria-live="polite">{status.message}</div>
      {status.phase === 'loading' && <progress aria-label="Model loading" max={1} value={status.progress ?? 0} />}
      {status.phase !== 'ready' && <button disabled={status.phase === 'loading'} onClick={load}>{status.phase === 'error' ? 'Retry model load' : providerID === 'ollama' ? 'Connect local Ollama' : 'Load local model'}</button>}
    </section>
    <section className="layout"><aside>
      <button disabled={busy} onClick={create}>+ New chat</button>
      {data.conversations.map(c => <button disabled={busy} className="chat" aria-pressed={active === c.id} onClick={() => { setActive(c.id); setRetry(undefined); setError(''); }} key={c.id}>{c.title}</button>)}
    </aside><article>
      {current ? <>
        <div className="messages" aria-label="Conversation">{current.messages.map(m => <div key={m.id} className={m.role}><small>{m.role === 'user' ? 'You' : 'NhomeAI'}</small><div>{m.text}</div></div>)}</div>
        {error && <div className="error" role="alert">{error}</div>}
        {retry && retry.id === current.id && <button disabled={busy || status.phase !== 'ready'} onClick={() => answer(retry)}>Retry response</button>}
        <form onSubmit={e => { e.preventDefault(); send(); }}>
          <input aria-label="Message NhomeAI" disabled={busy} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message NhomeAI" />
          {busy ? <button type="button" onClick={() => controller.current?.abort()}>Stop</button> : <button disabled={status.phase !== 'ready' || !draft.trim()}>Send</button>}
        </form>
      </> : <div className="empty">NhomeAI V1<br /><span>Choose or start a conversation.</span>{error && <p role="alert">{error}</p>}</div>}
    </article></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(console.error); });
}
