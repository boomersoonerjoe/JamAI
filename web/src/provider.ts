export interface ChatRequest { prompt:string }
export interface ChatProvider {
  id:string; name:string;
  isAvailable():Promise<boolean>;
  generate(request:ChatRequest,onUpdate:(text:string)=>void,signal:AbortSignal):Promise<string>;
}
export class UnconfiguredProvider implements ChatProvider {
  id="unconfigured"; name="Local AI provider";
  async isAvailable(){return false}
  async generate():Promise<string>{throw new Error("No cross-platform AI provider is configured yet.")}
}
