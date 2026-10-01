# Mac local chat

## Architecture and selection

The primary NhomeAI client is the React/TypeScript PWA in `web/`. `ChatProvider` owns availability, preparation and streamed generation; schema-v1 storage and bounded prompt construction remain independent of inference. The existing Swift/Apple/MLX implementation is preserved reference code, not the required desktop client.

The Mac/PC provider is Ollama over `http://127.0.0.1:11434`, with **Qwen3.5 4B Q4_K_M**, exact tag `qwen3.5:4b-q4_K_M`. The publisher lists about 3.4 GB of weights. This is a practical starting balance for the confirmed M5 MacBook Air with 16 GB unified memory: more conversational capacity than the browser's 1B model while leaving room for the OS. It is a reasoned selection, not a measured comparison against every candidate. MLX is attractive for Apple-specific optimization but would add a native bridge to the portable client; Ollama provides a common local HTTP API on macOS, Windows and Linux. Larger 9B weights take about 6.6 GB before runtime/context overhead and are not the starting default for this fanless 16 GB Mac.

Requests disable thinking, cap context at 4096 tokens and output at 512 tokens, use temperature 0.6 and keep the model loaded for two minutes. A new message array is sent per request, so app-owned context is authoritative across chats. The existing 1200/500/700 UTF-8-byte prompt/history/memory limits still apply. Token streaming, Stop, retry, missing-model errors, truncated-stream errors and empty responses are supported. Stop aborts the HTTP request; resource release timing still needs real-device observation. Model loading happens on the first response; Connect only verifies the daemon and installed weights.

There is no cloud fallback, API key, automatic model pull or remote endpoint configuration. The supplied daemon script disables cloud features, binds only loopback and permits the local development/preview origins. Desktop browsers initially select Ollama; mobile browsers initially select WebLLM. The runtime selector retains both providers. A phone cannot use the Mac through this loopback adapter; trusted LAN support remains a separate milestone.

## Setup and launch

Downloaded runtime and weights belong to ignored `.local-ai/`, never Git. To install the standalone official macOS runtime manually:

```sh
mkdir -p .local-ai/runtime
curl -fL --retry 3 https://ollama.com/download/ollama-darwin.tgz -o /tmp/nhomeai-ollama.tgz
tar -xzf /tmp/nhomeai-ollama.tgz -C .local-ai/runtime
```

Alternatively install Ollama from https://ollama.com/download/mac; the daemon script falls back to an `ollama` on PATH. This setup intentionally stores models in the workspace rather than the global Ollama model library.

From the repository root, keep this running in one terminal:

```sh
./scripts/start-local-ai.sh
```

Download the model once in another terminal (internet required):

```sh
OLLAMA_HOST=127.0.0.1:11434 ./.local-ai/runtime/ollama pull qwen3.5:4b-q4_K_M
```

If using a system installation, replace the runtime path with `ollama`. Model installation is verified by Ollama. The tag is explicit but publisher tags can change on future pulls; record the installed digest from `/api/tags`. Do not pull again to use offline.

Build once with Node 22+ and pnpm:

```sh
cd web
pnpm install --frozen-lockfile
pnpm test
pnpm run build
cd ..
./scripts/start-mac-chat.sh
```

Open **http://127.0.0.1:4173**, select **Local Ollama (Mac / PC)**, press **Connect local Ollama**, start a new chat and send a message. The preview script uses installed Node or the Codex bundled Node fallback. No Xcode, signing or Apple Developer subscription is needed for this PWA.

Both the preview server and Ollama can run with internet disconnected after setup. Visit the production page once online/local to cache the app shell for PWA launch; cached assets alone do not start the daemon. Keep using the same browser and origin to retain conversations. This is a local web client, not a packaged macOS app or auto-start service.

## Validation

Unit tests run without Ollama. Real inference is an explicit opt-in:

```sh
cd web
NHOMEAI_LIVE_TEST=1 pnpm test -- src/ollama-live.test.ts
```

The live test invokes the production provider, checks streamed output, then feeds a bounded conversation prompt and verifies recall of `7429`. It never pulls weights. After setup, personally verify browser permissions/CORS, Stop and retry, separate-chat isolation, conversation persistence after relaunch, and fresh generation with Wi-Fi disconnected. Safari/Chrome may ask permission to access a local service; allow loopback access for this local app. Benchmark sustained latency, memory, battery and thermals before expanding context/model size. No disconnected-network acceptance is inferred from unit tests.

## Primary sources

- Model/quantization: https://ollama.com/library/qwen3.5:4b-q4_K_M
- Local API, thinking control and streaming: https://docs.ollama.com/api/chat
- Loopback binding, cloud disablement, origins, model storage and GPU inspection: https://docs.ollama.com/faq
