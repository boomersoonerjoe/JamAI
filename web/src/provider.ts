import type { DeviceContext } from './device-context';
import type { SearchEvidence } from './search';
export interface ChatRequest { prompt: string; device?: DeviceContext; evidence?: SearchEvidence; responseKind?: 'source-selection' }
export interface ProviderStatus {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  progress?: number;
}
export interface ChatProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  dispose?(): Promise<void>;
  prepare(onStatus: (status: ProviderStatus) => void): Promise<void>;
  generate(request: ChatRequest, onUpdate: (text: string) => void, signal: AbortSignal): Promise<string>;
}
