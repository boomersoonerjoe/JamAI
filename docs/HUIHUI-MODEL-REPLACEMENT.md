# Huihui Qwen3-8B Abliterated v2 replacement

Completed October 3, 2026 on the M5 MacBook Air with 16 GB unified memory.

## Implementation and choice

The active desktop client is the React/TypeScript app in `web/`. Its Ollama provider streams from loopback `127.0.0.1:11434`. Browser WebLLM and Swift MLX reference code are separate providers and were not changed. Conversation history and saved notes remain in the existing browser storage, with the existing bounded context and memory retrieval.

Replaced the selected `qwen3.5:4b-q4_K_M` model with the publisher's own `huihui_ai/qwen3-abliterated:8b-v2-q4_K_M`. This is v2, 8.2B parameters, GGUF Q4_K_M, not the older 8B tag. Ollama 0.35.0 already supports its thinking toggle, streaming and JSON-schema constraints and offloaded all 37/37 layers to the Apple M5 Metal GPU. Retaining that tested runtime avoids adding a separate MLX server/provider and migrating the app's constrained retrieval modes. MLX remains a viable alternative, but no comparative MLX benchmark was performed.

Source model and derivative use Apache 2.0. The source model card links the publisher's Ollama v2 release. No new inference account, API key, subscription or paid service was used.

- Source: https://huggingface.co/huihui-ai/Huihui-Qwen3-8B-abliterated-v2
- Exact quantized release: https://ollama.com/huihui_ai/qwen3-abliterated:8b-v2-q4_K_M
- Installed manifest digest: `543f9deff86d8347fd96ea1f3e54e73861ea70d52def71d31ccaeaf013de6ba6`
- Model-weight SHA-256: `6da140c19a3625dc4e98e57a2d87cab5b5613854402f1f389def4540037541ab`
- Total installed model files: 5,027,793,060 bytes, about 5.03 GB / 4.68 GiB. Ollama verified SHA-256 before writing its manifest.

The previous model files were retained for reversible rollback; the app no longer selects them. Downloads and test logs stay in ignored `.local-ai/`.

## Scoped changes

- Changed the Mac model identifier and visible model/setup text.
- Updated the ordinary-chat instruction to answer benign creative/sensitive requests directly and avoid unsolicited moralizing, generic capability disclaimers and repetitive safety boilerplate. Inspection found no separate blanket-refusal filter to remove.
- Kept factual uncertainty, evidence validation, untrusted-note/source boundaries, explicit memory commands, endpoint restrictions, cloud disablement and HTTP cancellation intact.
- Added opt-in real-model tests for normal/benign sensitive requests and structured retrieval compatibility; updated Mac setup documentation.

No storage schema, history, saved notes, interface layout, location/retrieval implementation, browser model or Swift implementation was changed. Existing uncommitted work was preserved; pre-edit copies of touched existing files are in `.local-ai/huihui-replacement-before/`.

## Validation

174 non-live tests passed, including persistence, memory, HTTP origin/private-target protections, retrieval validation, streaming errors and cancellation. TypeScript and the Vite production build passed. The first restricted test run could not bind loopback fixture servers; the same suite passed with local socket access. The existing WebLLM bundle-size advisory remains.

Seven real-model tests passed through the production provider with Ollama's external networking denied by the project's existing `scripts/local-ai-offline.sb` profile:

1. Ordinary explanation, neutral cannabis-policy arguments, non-graphic consensual adult romance and fictional dialogue with mild profanity: all answered without the checked refusal/boilerplate patterns.
2. Explicit saved-memory persistence, new-chat recall, edited-note recall and deletion/non-invention, using a test-only storage fixture rather than user notes.
3. Streaming conversation history recall of `7429`.
4. Abort a streamed response and successfully retry with a new request.
5. Multi-step arithmetic with bounded reasoning: correct `$99` on both attempts.
6. Structured retrieval planner, source-selection JSON and quote-grounded answer JSON.
7. Cached article subject and follow-ups after serialized reload, without new search or page reads.

The blocked profile also rejected an external connection check. The actual local app showed the new model as Ready, along with the existing conversation list and Memory (2). The original auto-start service was temporarily paused for offline testing and restored afterward; its configuration files were not edited.

### Measured performance and memory

First new-model reply: first text in 3.09 seconds; completed in 5.34 seconds. Short warm ordinary replies: first text in 0.20–0.27 seconds, completed in 0.72–3.88 seconds. Runtime generation logs measured approximately 25 tokens/second. Arithmetic reasoning takes longer; two arithmetic attempts took about 31 seconds combined. These are smoke-test observations, not sustained thermal/battery benchmarks.

Ollama reported loaded-model memory of 5,722,288,946 bytes at 4096 context and 5,980,395,928 bytes at 8192 context, all on GPU (about 5.33–5.57 GiB). This is loaded-model memory, not total process peak or whole-Mac RAM. System memory pressure sampled every two seconds stayed normal (1) throughout both runs, with no additional swap growth. Monitors would stop for critical pressure, warning pressure sustained over eight seconds, or more than 1 GiB additional swap.

### Limits

Passing these samples does not guarantee the absence of every refusal or factual error. In the cached-source test, the correct subject and coalition were preserved, but the model added unsupported interpretation about influence/political strategy. Less refusal is not stronger factual grounding; existing validation safeguards remain necessary. No unrelated retrieval rewrite was made. User-owned history was visibly retained; full browser-process/Mac restart, long-session thermals and every V1 online-query scenario were not retested in this replacement.

Use the same browser/profile and origin (`http://127.0.0.1:4173`) to keep existing local history and memory. Reload the app to load the new build; if a cached older build remains, close its old tabs and reopen. Normal inference works offline; the existing optional free web retrieval setting remains independent.
