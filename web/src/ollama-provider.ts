import { systemInstructions, inferencePrompt } from './inference-context';
import type { ChatProvider, ChatRequest, ProviderStatus } from './provider';

export const MAC_MODEL = 'qwen3.5:4b-q4_K_M';
const ENDPOINT = 'http://127.0.0.1:11434';

// Loopback only: this adapter never sends prompts to a LAN or cloud endpoint.
export class OllamaChatProvider implements ChatProvider {
  readonly id = 'ollama';
  readonly name = 'Qwen3.5 4B · Q4_K_M · local Ollama';
  private ready = false;
  private generating = false;
  constructor(private request: typeof fetch = globalThis.fetch.bind(globalThis)) {}
  private async models(): Promise<string[]> {
    const response = await this.request(`${ENDPOINT}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
    const data = await response.json() as { models: { name: string }[] };
    return data.models.map(model => model.name);
  }
  async isAvailable() {
    try { return (await this.models()).includes(MAC_MODEL); } catch { return false; }
  }
  async prepare(report: (status: ProviderStatus) => void) {
    this.ready = false;
    report({ phase: 'loading', message: 'Checking local Ollama and installed model…' });
    try {
      if (!(await this.models()).includes(MAC_MODEL)) throw new Error(`Install the model first: ollama pull ${MAC_MODEL}`);
      this.ready = true;
      report({ phase: 'ready', message: 'Ready · replies run on this computer through local Ollama' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Local chat is not ready. ${detail} If Ollama is unreachable, start it on this computer.`;
      report({ phase: 'error', message });
      throw new Error(message);
    }
  }
  async generate(request: ChatRequest, onUpdate: (text: string) => void, signal: AbortSignal) {
    if (!this.ready) throw new Error('Connect to local Ollama first.');
    if (this.generating) throw new Error('A response is already running.');
    signal.throwIfAborted();
    this.generating = true;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await this.request(`${ENDPOINT}/api/chat`, {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MAC_MODEL, stream: true, think: false, keep_alive: '2m',
          ...(request.responseKind === 'source-selection' ? { format: {
            type: 'object', properties: { selected: { type: 'array', items: { type: 'integer' }, maxItems: 4 } },
            required: ['selected'], additionalProperties: false,
          } } : {}),
          messages: [
            { role: 'system', content: systemInstructions(request) },
            { role: 'user', content: inferencePrompt(request) },
          ], options: { num_ctx: 4096, num_predict: 512, temperature: 0.6 } }),
      });
      if (!response.ok) throw new Error(`Local Ollama returned HTTP ${response.status}. Check that the model is installed.`);
      if (!response.body) throw new Error('Ollama returned no response stream.');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', text = '', done = false;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const chunk = JSON.parse(line) as { error?: string; message?: { content?: string }; done?: boolean };
        if (chunk.error) throw new Error(chunk.error);
        text += chunk.message?.content ?? '';
        if (chunk.message?.content) onUpdate(text);
        if (chunk.done) done = true;
      };
      while (!done) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        signal.throwIfAborted();
        buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
        }
        if (chunk.done) { consume(buffer); break; }
      }
      signal.throwIfAborted();
      if (!done) throw new Error('Local response stream ended early. Retry the response.');
      if (!text.trim()) throw new Error('The local model returned no text. Retry the response.');
      return text;
    } finally {
      try { await reader?.cancel(); } finally { reader?.releaseLock(); this.generating = false; }
    }
  }
}
