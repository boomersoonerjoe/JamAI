# Weather units and request latency

Tested October 3, 2026, on the owner's M5 MacBook Air, 16 GB RAM, with the existing Huihui Qwen3-8B Abliterated v2 Q4_K_M and Ollama 0.35.0. No model replacement, context truncation, decoding budget reduction, paid service, or storage migration.

## Measurements

Production `answerConversation` + Ollama provider + local HTTP weather endpoint, Internet mode Auto. Times include provider preparation, context construction, planning, retrieval, inference and validation through the first nonempty `onUpdate` and completed answer. Cold means the model was explicitly unloaded before the request; warm follows that request. This is one sample per case, not a percentile or guaranteed future latency. Live HTTP timing varies. Local questions have actual streamed tokens; direct weather answers have first visible text and no model generation tokens.

| Request / model state | Before first text | After first text | Before total | After total |
|---|---:|---:|---:|---:|
| Oklahoma capital, cold | 16.58 s | 3.76 s | 16.91 s | 4.10 s |
| Oklahoma capital, warm | 13.95 s | 0.47 s | 14.29 s | 0.80 s |
| Tulsa current weather, cold | 11.41 s | 4.43 s | 11.41 s | 4.43 s |
| Tulsa current weather, warm | 6.25 s | 0.16 s | 6.25 s | 0.16 s |

Raw per-stage timings, prompt lengths and answers are in `WEATHER-LATENCY-RESULTS.json`. Reproduce with `NHOMEAI_PROFILE_PHASE=before` or `after` and the opt-in `src/pipeline-profile.test.ts`, using running local services and `--config vitest.config.ts --silent=false`. A true before comparison requires the previous implementation, not merely changing the phase label. Do not benchmark simultaneously with other inference.

## Where time went

- Local cold baseline did an unnecessary semantic planner call, then an answer call. The planner used 8,192 context tokens and chat used 4,096. Ollama unloaded/recreated its runner between these configurations: load times were 6.50 s + 5.58 s cold and 5.29 s + 4.26 s even on the warm turn. This was the dominant delay.
- Planner input was 860 tokens: approximately 1.77 s prompt evaluation and 1.53–1.57 s decoding for the local question. Ordinary answer input was 499 tokens: approximately 1.04 s evaluation and 0.33 s decoding. The prompt budget was not the main problem. Existing bounded history and memory selection remain intact.
- Warm weather planning took 2.74 s; weather HTTP retrieval 1.68 s; model synthesis 1.80 s. Evidence answers were withheld until validation, so underlying first model text at 5.20 s was not visible until 6.25 s. Removing inference for exact structured weather facts removes this entire buffered synthesis step without sacrificing factual accuracy.
- Empty-memory context construction was below 1 ms. An independent synthetic 1,000-note benchmark measured initial indexing + context 3.09 ms, warm median 0.13 ms, warm p95 0.26 ms, with a 584-byte bounded prompt. No embedding runtime or network is used for memory. Actual memory persistence/edit/delete and history recall are covered by live tests.
- Separate uncached HTTP diagnostics measured forward geocoding 620 ms and forecast retrieval 574 ms (1.20 s combined). A verified geocode cache eliminates the first request on repeated locations; forecast data is still freshly fetched and freshness/date/unit checks still run. Unknown/live topics keep the semantic planner and their existing search/article pipeline; those routes remain dependent on external site response time.

## Changes

All chat, planner and preload calls use 8,192 context tokens. Model preparation actually preloads weights, and calls renew a ten-minute idle keep-alive. No indefinite background work or periodic fake prompts. Straightforward creative/general questions skip unnecessary semantic planning; ambiguous/changing facts, explicit web requests and public-topic follow-ups retain planning. Complex weather/advice requests retain model synthesis and evidence validation.

Weather units are chosen by verified country metadata at the API layer. U.S. places and territories use Fahrenheit; other countries follow Unicode CLDR weather-unit preferences. Coordinates obtain country metadata from the existing bounded reverse-geocoding service, instead of falling back to Celsius or guessing from time zone. A positive-only, bounded ten-minute cache holds location metadata; it does not cache weather readings. Answers remain conversational, and weather validators reject swapped Celsius/Fahrenheit labels as well as invented numbers. Prefixes such as `current tulsa weather` correctly retain their explicitly named city.

The original f16 8K runner reported 6,330,463,026 bytes (about 5.90 GiB). Sustained live testing reached macOS memory-pressure level 2 (warning), with swap rising from about 1.93 GiB to 5.35 GiB; further inference paused and the model was unloaded, returning pressure to level 1. Investigation also found an 8,192 MiB default saved-prompt-state cache that actually grew to 4,559 MiB during the extended run. Final settings enable Flash Attention and q8_0 K/V cache (612 MiB, verified in runtime logs) and cap accumulated saved prompt states at 256 MiB using `LLAMA_ARG_CACHE_RAM`. Active context remains 8,192 tokens; no history or memory is deleted. Final loaded runner reports 5,881,766,870 bytes (about 5.48 GiB). Idle expiry remains ten minutes. The saved-state cap changes reuse/reevaluation, not answer content. The q8_0 precision choice is documented by Ollama as usually having no noticeable quality impact; the complete live suite passed after this change. The final sustained run remained at memory-pressure level 1, and the observed saved-state cache maximum was 226.2 MiB. Swap declined to approximately 3.32 GiB rather than continuing to grow.

Official references: [Ollama request/metrics/keep-alive API](https://docs.ollama.com/api/generate), [Ollama cache/Flash Attention guidance](https://docs.ollama.com/faq), [llama.cpp saved-state cache cap](https://github.com/ggml-org/llama.cpp/blob/master/common/arg.cpp), [Unicode CLDR weather temperature preferences](https://github.com/unicode-org/cldr/blob/main/common/supplemental/units.xml).

## Validation

The explicit regression configuration includes backend `.test.mjs` fixtures as well as frontend `.test.ts` files. Both were also included in the original baseline suite. Models, dependencies, logs and browser data are excluded from Git. Final combined run: 206 passed, four optional profiling/input-driven tests skipped. Both `NHOMEAI_LIVE_TEST=1` and `NHOMEAI_SEARCH_LIVE_TEST=1` were enabled. Coverage includes real streaming, cancellation/retry, ordinary and benign sensitive replies, structured planning, saved-note persistence/edit/delete, history and cached article recall, live weather/news/prices, local-day/date/unit guards, wrong-city rejection, fresh readings through a geocode-cache hit, and origin/private-network protections. The four skips are two profiling diagnostics (run separately) and two input-file harnesses with no supplied fixture file. Separate final pipeline and 1,000-note memory profiles passed. TypeScript, production Vite build, offline service-worker generation, startup-script syntax and Git whitespace checks passed. The existing optional WebLLM bundle-size advisory remains.
