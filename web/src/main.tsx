import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { loadData, saveData } from './storage';
import type { AppData, Conversation, Message } from './types';
import { buildPrompt } from './context';
import type { ChatProvider, ProviderStatus } from './provider';
import { LocalChatProvider } from './local-provider';
import { OllamaChatProvider } from './ollama-provider';
import { deviceContext, isDeviceClockQuestion } from './device-context';
import { answerConversation } from './chat-service';
import { safeSourceURL, type SearchMode, type SearchEvidence } from './search';

const id = () => crypto.randomUUID();
const msg = (text: string, role: 'user' | 'assistant'): Message => ({ id: id(), text, role, createdAt: new Date().toISOString() });
function DeviceClock() {
  const [clock, setClock] = useState(deviceContext);
  useEffect(() => { const timer = setInterval(() => setClock(deviceContext()), 1000); return () => clearInterval(timer); }, []);
  return <small className="device-clock"><time dateTime={clock.isoTime}>Device clock: {clock.weekday}, {clock.localDate} · {clock.localTime} {clock.utcOffset}</time><br />{clock.timeZone}</small>;
}
function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const dataRef = useRef(data);
  const [active, setActive] = useState<string>();
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<ProviderStatus>({ phase: 'idle', message: 'Connect or load the selected runtime to start local chat.' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<Conversation>();
  const [activity, setActivity] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>(() => {
    const saved = localStorage.getItem('nhomeai.search-mode.v1');
    return saved === 'off' || saved === 'always' || saved === 'web' ? saved : 'auto';
  });
  const controller = useRef<AbortController | null>(null);
  const [providerID, setProviderID] = useState(() => /Macintosh|Windows|X11|Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent) && !(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ? 'ollama' : 'webllm');
  const provider: ChatProvider = useMemo(() => providerID === 'ollama' ? new OllamaChatProvider() : new LocalChatProvider(), [providerID]);
  useEffect(() => () => { void provider.dispose?.().catch(console.error); }, [provider]);
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
      buildPrompt(c, dataRef.current.memories);
      replace(c);
      const publish = (text: string, evidence?: SearchEvidence) => replace({ ...c, messages: [...c.messages, { ...response, text, ...(evidence ? { evidence } : {}) }] });
      const result = await answerConversation(c, dataRef.current.memories, provider, {
        mode: searchMode, signal: abort.signal, onUpdate: publish, onActivity: setActivity,
      });
      if (!result.text.trim()) throw new Error('The model returned an empty response. Try again.');
      publish(result.text, result.evidence);
      if (result.retryable) setRetry(c);
    } catch (e) {
      setError(abort.signal.aborted ? 'Response stopped. You can retry.' : e instanceof Error ? e.message : String(e));
      setRetry(c);
    } finally { controller.current = null; setBusy(false); setActivity(''); }
  }
  function send() {
    if (!current || !draft.trim() || busy || (status.phase !== 'ready' && !isDeviceClockQuestion(draft))) return;
    const text = draft.trim();
    const c = { ...current, messages: [...current.messages, msg(text, 'user')] };
    if (c.messages.length === 1) c.title = text.slice(0, 48);
    try { buildPrompt(c, dataRef.current.memories); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return; }
    setDraft(''); void answer(c);
  }
  return <main>
    <header><h1>NhomeAI</h1><small>Private cross-platform AI · local-first</small><DeviceClock /></header>
    <section className="model">
      <label>Chat runtime <select aria-label="Chat runtime" value={providerID} disabled={busy || status.phase === 'loading'} onChange={e => {
        setProviderID(e.target.value); setStatus({ phase: 'idle', message: 'Connect or load the selected runtime to start chat.' }); setError('');
      }}><option value="ollama">Local Ollama (Mac / PC)</option><option value="webllm">On-device browser (WebGPU)</option></select></label>
      <p><strong>{provider.name}</strong></p>
      {providerID === 'ollama' ? <p>Install Ollama and Qwen3.5 4B once, then connect. AI replies and summaries run on this computer and work offline. Ollama must be running at 127.0.0.1:11434. No cloud fallback.</p> : <p>First load downloads model assets from Hugging Face and the WebLLM runtime CDN, then caches them in this browser. Chats run on this device. Allow roughly 1 GB or more of free storage and memory; keep the app open while loading.</p>}
      <div role="status" aria-live="polite">{status.message}</div>
      {status.phase === 'loading' && <progress aria-label="Model loading" max={1} value={status.progress ?? 0} />}
      {status.phase !== 'ready' && <button disabled={status.phase === 'loading'} onClick={load}>{status.phase === 'error' ? 'Retry model load' : providerID === 'ollama' ? 'Connect local Ollama' : 'Load local model'}</button>}
    </section>
    <section className="search-settings">
      <label>Internet search <select aria-label="Internet search" disabled={busy} value={searchMode} onChange={e => {
        const next = e.target.value as SearchMode; localStorage.setItem('nhomeai.search-mode.v1', next); setSearchMode(next);
      }}><option value="auto">Auto · current-information questions</option><option value="always">Always · automatic sources</option><option value="web">Always · general web</option><option value="off">Off · offline only</option></select></label>
      <p>Free search sends this message’s search query to free web search sites (Bing/Brave) or news RSS; weather requests may use free Open-Meteo. Saved notes and other chat turns stay local. AI processing stays on your device. Search can fail or be incomplete; current facts require retrieved evidence.</p>
      {activity && <div role="status" aria-live="polite">{activity}</div>}
    </section>
    <section className="layout"><aside>
      <button disabled={busy} onClick={create}>+ New chat</button>
      {data.conversations.map(c => <button disabled={busy} className="chat" aria-pressed={active === c.id} onClick={() => { setActive(c.id); setRetry(undefined); setError(''); }} key={c.id}>{c.title}</button>)}
    </aside><article>
      {current ? <>
        <div className="messages" aria-label="Conversation">{current.messages.map(m => <div key={m.id} className={m.role}><small>{m.role === 'user' ? 'You' : 'NhomeAI'}</small><div>{m.text}</div>{m.evidence && <div className="sources">
          <small>{m.evidence.provider} · retrieved {new Date(m.evidence.fetchedAt).toLocaleString()} · {m.evidence.scope === 'today' ? `publication dates matched the device's local day (${m.evidence.timeZone})` : m.evidence.scope === 'weather' ? 'current model-based weather; not a station observation' : 'results may be incomplete or outdated'}.</small>
          <ol>{m.evidence.sources.filter(source => safeSourceURL(source.url)).map((source, index) => <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">[{index + 1}] {source.title}</a>
            <small>{source.publisher}{source.publishedAt ? ` · published ${new Date(source.publishedAt).toLocaleString()}` : ' · publication date not verified'}</small>
          </li>)}</ol>
          <details><summary>Retrieved excerpts · not full articles</summary>{m.evidence.sources.map((source, index) => <p key={source.url}>[{index + 1}] {source.excerpt}</p>)}</details>
        </div>}</div>)}</div>
        {error && <div className="error" role="alert">{error}</div>}
        {retry && retry.id === current.id && <button disabled={busy || status.phase !== 'ready'} onClick={() => answer(retry)}>Retry response</button>}
        <form onSubmit={e => { e.preventDefault(); send(); }}>
          <input aria-label="Message NhomeAI" disabled={busy} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message NhomeAI" />
          {busy ? <button type="button" onClick={() => controller.current?.abort()}>Stop</button> : <button disabled={(status.phase !== 'ready' && !isDeviceClockQuestion(draft)) || !draft.trim()}>Send</button>}
        </form>
      </> : <div className="empty">NhomeAI V1<br /><span>Choose or start a conversation.</span>{error && <p role="alert">{error}</p>}</div>}
    </article></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(console.error); });
}
