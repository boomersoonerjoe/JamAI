# NhomeAI V1 local-first chat

The portable React/TypeScript PWA, schema-v1 local storage and provider-neutral ChatProvider remain the foundation. The new chat-service orchestrates device context, optional retrieval and local inference. Existing Swift reference code is unchanged.

## Behavior and privacy

- Device date, time, weekday, UTC offset and IANA time zone come from Date/Intl, refreshed per request. The header ticks independently. Direct clock questions work without internet or a loaded model. Accuracy depends on the device clock.
- Ordinary conversation runs locally, using Ollama on desktop or the retained WebLLM browser adapter. No cloud AI fallback.
- Auto search recognizes common current-information wording, including “Tulsa news today.” Always · automatic sources handles other wording; Always · general web also searches news questions through HTML engines; Off disables retrieval. Auto is a heuristic, not comprehensive intent detection. Unrecognized changing-fact questions receive a model instruction to decline unsupported current claims; that instruction alone cannot guarantee model compliance.
- A loopback Node server retrieves free Google News RSS for news. General web search parses organic HTML results from Brave, then Bing, with Bing RSS as a final fallback. No account, API key or paid API. These public endpoints are best effort and may change, block requests, return irrelevant results or omit coverage. No challenge bypass, search-engine AI answer scraping, full article scraping or arbitrary URL fetching.
- Only the current question is used as the external query. Saved notes/history remain local. Search sites see the query, normal network metadata and, for news, a derived calendar date range. No GPS/location permission. Opening a source link makes an ordinary third-party browser visit.
- Current answers are extractive: local Ollama selects/ranks source IDs; the app validates IDs and publishes exact retrieved headlines/snippets with numbered source links. Generated factual prose is never published in this path. This prevents model-added current facts, but cannot guarantee a publisher's accuracy. Extra model prose and fabricated source IDs are rejected.
- Today-news results require publication metadata matching the device's exact calendar day/time zone; future and undated entries are discarded. News publication metadata is supplied by the feed, not independently audited. General web snippets have unknown publication dates and are labeled accordingly; today-specific web questions can retrieve relevant snippets, but never claim verified publication dates or live accuracy; the answer includes that warning. Weather, prices and other live data are not guaranteed by general search snippets.
- Missing connectivity, sources or valid selection produces an explicit refusal rather than a guessed current answer. Previously saved citations retain their retrieval timestamp; they are not refreshed or represented as today's new evidence. Sources persist additively within schema-v1 messages.

## Run on the Mac

The existing installed runtime is Ollama 0.35.0 with Qwen3.5 4B Q4_K_M (`qwen3.5:4b-q4_K_M`). Model processing stays on the Mac. In separate terminals from the repository:

```sh
./scripts/start-local-ai.sh
./scripts/start-mac-chat.sh
```

Open http://127.0.0.1:4173 and connect local Ollama. The second script now runs the retrieval/static server, replacing Vite preview. Model weights/runtime are ignored local files, not part of Git. See MAC-LOCAL-AI.md for initial setup. No additional model download is needed on this Mac.

For a rebuild, use Node 22+ and pnpm in web/: `pnpm install`, `pnpm test`, `pnpm run build`, `pnpm start`. Vite development at port 5173 proxies /api/search to the separately running server on 4173. A static-only host or Vite preview alone cannot provide online search.

The Node service uses portable APIs and the provider contract remains portable. Launch scripts and outbound-blocking test profile are Mac-specific conveniences. Windows/Linux launch instructions, mobile retrieval deployment and physical mobile acceptance remain future work. The server binds loopback only; it is not exposed to phones/LAN. Native browser inference and cached offline chat remain available where WebGPU/model assets are supported.

## Mac validation, 2026-10-01

- Production TypeScript/Vite build passed (39 modules; existing large WebLLM bundle advisory).
- 31 unit/HTTP tests passed, including clock/DST/calendar boundaries, privacy, exact extraction, malformed/fabricated source selections, offline refusals, cancellation, safe links, bounded feeds, origin/host/body validation and static traversal protection.
- Three opt-in real tests passed: live dated Tulsa news retrieved through the server and summarized through installed Ollama; streaming and app-owned recall of 7429; Stop and successful fresh request.
- Mac browser: live news summary/citations visible, saved citations survive reload; header and combined date/time answer correct; ordinary greeting works while both server and Ollama outbound internet are blocked with the sandbox profile; news request in that condition explicitly refuses current facts. Normal retrieval server restored afterward.

Owner acceptance remains: open the preview, ask date/time, ordinary chat and Tulsa news today, follow source links, and try with Wi-Fi disconnected. The agent tested blocked outbound processes without altering the owner's Wi-Fi settings. Broader queries, search relevance and other platforms need acceptance; no full-article synthesis, live-data guarantees, packaging/autostart or mobile retrieval rollout is claimed.

## Conversational-query correction

On 2026-10-01 the owner's full Tulsa question exposed an overconstrained upstream query. News search now strips common question/response scaffolding into topic keywords and tries a second upstream date syntax if the first returns no dated matches. Exact local-day validation is never relaxed. The exact owner query is the opt-in live regression. All 36 tests (including three live tests) and the production build passed after the correction. Ollama selects headlines at temperature zero, with explicit guidance that relevant dated headlines can answer broad news-summary requests. Free public feed reliability is still outside the application's control.

## General web expansion, 2026-10-01

The free tool now uses normal Node HTTP requests and Cheerio to parse organic HTML search results, not only RSS. Brave is preferred; Bing HTML and Bing RSS provide bounded fallbacks. Each request has an 8-second per-engine timeout, 25-second combined budget, 1 MiB response limit, up to four safe HTTP/S source links, and cancellation. Redirects are rejected. HTML scripts/styles/markup are stripped; search-engine generated answer boxes and ads are excluded. No API keys, account, paid credits, cloud inference, or extra dependencies were added.

Auto triggers now include products, price/cost, comparisons/reviews/recommendations, research, common device shopping terms, weather and current events in addition to news/latest/current wording. This remains a deterministic heuristic; Always modes cover missed wording. News RSS is retained with its exact local-day date filter. Always · general web can search any topic, including news, through HTML engines.

Query normalization strips common research/comparison commands and puts the subject ahead of generic recency/price adjectives. Public engine relevance and access are not guaranteed. In live Mac tests Brave's Node requests were rate-limited; the app respected that failure and used Bing. Some Bing results were too broad until topic-first normalization. No CAPTCHA or blocking page was bypassed.

Qwen3.5 4B Q4_K_M on Ollama 0.35.0 continues to select exact excerpts locally, with sources and persisted retrieval timestamps. It can supply sourced search excerpts and useful links; it cannot infer missing product comparisons, exact live prices, numeric current weather, publication dates or full-page findings. A weather search that returns forecast-page descriptions is a list of sources, not a verified forecast. Specialized weather/retailer data and full-page retrieval are future improvements. Search sites see only the current normalized query (and normal request metadata); notes and other turns never leave the device.

Mac checks: production build passed; 38 unit/HTTP tests plus 8 real tests passed. Live queries covered exact Tulsa news, Tulsa weather today, MacBook Air current price, latest budget laptops, Oklahoma current events and solar-panel research, plus ordinary Ollama streaming/recall/Stop/retry. UI confirmed automatic HTML search with links. With outbound internet blocked, general weather search refused unsupported facts while ordinary local greeting worked. Online server restored afterward. Windows/Linux/mobile acceptance remains pending; implementations use portable Node/browser APIs, while test sandbox/launch conveniences remain Mac-specific.
