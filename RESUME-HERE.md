# Real Mac location failure correction (2026-10-02)

Owner real Mac location test FAILED; **do not mark device-location hardware acceptance PASS until owner manually retests**. Read docs/LOCATION-RUNTIME-FIX.md. Direct current-location questions previously bypassed resolver; fixed deterministic answers and saved fallback with no model required. Corrected Permissions API gating across successful callbacks and persisted explicit opt-in; denied access still falls back. Enable intent persists despite no coordinate reading; foreground acquisition 45s/20s, Refresh/off controls and stage diagnostics. Added bounded /api/location city conversion and lookup-failure saved fallback. Never infer city from timezone.

Actual agent Mac geolocation requests timed out without real coordinates; no sensor success claimed. Real endpoint public Tulsa coordinates → Tulsa, OK HTTP 200; actual UI both direct location queries → saved Tulsa, weather → Tulsa and nearby → Tulsa sources. Full live suite 106/106 passed; final affected suite 33/33 passed; build passed. No push/merge; services running on localhost4173. Earlier statuses below are historical.

# Location context/services checkpoint (2026-10-02)

Owner manual Wi-Fi-off/local chat and Wi-Fi-on/live Tulsa search: PASSED. Added platform-neutral location resolution with optional foreground Browser Geolocation, explicit permission enable/off controls and persistent manual fallback. Latest user city in chat wins over automatic/default location; explicit query city wins over all context. Saved memory location works across chats. No physical-city inference from time zone. Device coordinates rounded to two decimal places; free Open-Meteo weather and Photon/OpenStreetMap nearby city lookup; nearby city/subject matches enforced. No Always/background location and no paid API.

Read docs/LOCATION.md. Full live suite 102/102 passed; final affected location/server suite 28/28 passed; build passed. Exact Mac UI Tulsa declaration → implicit outside weather passed. Actual sensor/permission prompts on Mac and physical iPhone remain owner tests; permission behavior exercised through fixtures, no owner sensor coordinates requested/shared. No push or merge; stay on codex/cross-platform-foundation.

# Final V1 validation checkpoint (2026-10-02)

Stay on codex/cross-platform-foundation; no push or merge. Read docs/V1-FINAL-VALIDATION.md for the complete function matrix, failures fixed, evidence and remaining acceptance gates. Final complete web suite: 92/92 passed with live tests enabled and none skipped; production build passed. Native iPhone 18 Pro/iOS 27 simulator XCTest: 19/19 passed; not iPhone 14 Pro Max acceptance or portable feature parity.

Validation fixed supplied-price arithmetic being routed online, enabled bounded Qwen reasoning only for recognized arithmetic after an incorrect $93 total (correct $99), and stopped cancelled stream fragments from being saved as completed replies. Real UI midstream Stop/reopen/Retry and completion persistence pass. Service restart, loopback-only Ollama, blocked retrieval/reconnection, memory and cached article follow-ups pass. Full browser-process/Mac reboot, physical Wi-Fi/sleep-wake and physical iPhone acceptance remain manual. Overall V1 acceptance estimate ~80%; not a percentage calculated from test counts. Actual Mac WebGPU Llama 3.2 1B load, knowledge, arithmetic and cross-chat saved-memory recall also passed; Qwen/Ollama restored afterward. Both local services remain running at http://127.0.0.1:4173. Earlier sections below are historical.

# Current persistent-memory checkpoint (2026-10-02)

Remain on codex/cross-platform-foundation; no push or merge. Portable web/PWA now saves explicit memory commands locally and supports a Memory panel for add/view/find/edit/delete. Notes migrate from state schema v1 into nhomeai.memories.v1; chat streaming preserves newer memory edits and does not rewrite the collection. Relevant notes are retrieved with a cached local inverted index, capped at five/2,000 UTF-8 bytes. Local Qwen/WebLLM receive notes as user facts, never trusted instructions; web search receives only the question.

Read docs/PERSISTENT-MEMORY.md. Mac: 64 unit/HTTP/persistence + 7 targeted live checks passed, production build passed. Real new-chat recall and edited recall after local server restart + browser-tab reopening passed with search Off. Full browser-process/Mac reboot and other-platform physical tests remain unperformed. Browser/profile/origin storage boundary remains; clearing site data removes notes, and deleting memory does not erase existing chat messages. One clearly fictional lighthouse test note remains in the agent's in-app browser profile. Internet search was restored to Auto after tests. App server and local Ollama are running at http://127.0.0.1:4173.

# Current retrieval-context checkpoint (2026-10-02)

Stay on codex/cross-platform-foundation; do not push or merge. Search evidence is now saved regardless of source visibility. Article/story follow-ups recall saved evidence; public article URLs can be read once with bounded safe Node retrieval and cached for reload/offline follow-ups. Explicit article references can reach across intervening turns; generic references do not drag unrelated old topics in. Stronger source-person reference instructions and temperature zero for retrieved replies address the Trump/Vance confusion; models remain fallible. Source cards are still opt-in; normal chat stays local.

Read docs/RETRIEVAL-CONTEXT.md for implementation/tests/privacy/limits. Older chats whose evidence was discarded need one new retrieval. Real NASA public article and synthetic Trump-name regression pass; browser reload + search-Off follow-up verified, Auto restored. Physical other-platform acceptance remains pending. Runtime/model installed; start scripts/start-local-ai.sh and scripts/start-mac-chat.sh at localhost:4173. New /api/article server must run for uncached public article reads.

# Current weather wording checkpoint (2026-10-02)

The owner screenshot exposed location parsing of “Tulsa,ok supposed to be” instead of “Tulsa,ok”. Fixed phrase separation and added free Open-Meteo today high/low/rain chance for expected-weather queries. Location-local date/units checked; right-now weather stays current data. 41 unit/HTTP + 4 exact live routing/forecast tests and build passed; exact screenshot query works in Mac UI. Confirmed loopback retrieval server restarted. Refresh app/connect local Ollama before owner retest. No push/merge; remain on codex/cross-platform-foundation. Other forecast periods retain existing general search behavior.

# Current routing checkpoint

Keep codex/cross-platform-foundation; do not push or merge. Latest owner request supersedes prior quote validation and source-warning UX: ordinary/stable questions go directly to local Qwen/Ollama; only live information or explicit search uses retrieval. Natural streamed replies, sources only when asked, no validation refusals or automatic warnings. Search settings retain Off and web preference; legacy Always values no longer force ordinary queries online. Clock/privacy/free bounded retrieval remain. 57 Mac regressions passed; final owner examples passed (Oklahoma City, 3 hours, current Tulsa weather). Read current docs/LOCAL-FIRST-CHAT.md section; earlier entries are historical.

# Current conversational-answer checkpoint

Remain on codex/cross-platform-foundation. The user forbids push/merge. Latest changes implement locally generated cited conversational sentences with exact quote/source validation, conservative news/name/number checks, one repair and partial supported-sentence retention. All 60 Mac checks passed (46 unit/HTTP + 14 live), production build passed. Read docs/LIVE-CHAT-VALIDATION.md for 12 live retrieval questions and honest limitations: prices/comparisons often absent, broad research snippets inadequate, no complete-page fetching. Weather/news sources and Qwen/Ollama remain free/local-first. Semantic validation reduces risk but does not formally prove every paraphrase.

Mac UI verified conversational weather and product replies. Start existing scripts/start-local-ai.sh and scripts/start-mac-chat.sh, connect at http://127.0.0.1:4173. Local runtime/model already installed. Earlier remote commits remain unchanged; newer work is local only. Other platforms and owner acceptance remain pending.

# Current weather-location checkpoint

Earlier checkpoint: work was local on codex/cross-platform-foundation. The October 3 weather/latency request explicitly authorizes committing all pending NhomeAI changes and pushing this branch after tests pass. Latest fix preserves general search details, rejects wrong-city weather results, and adds free noncommercial Open-Meteo current model weather for validated named locations with explicit resolved place/time/units and attribution. Qwen/Ollama remain local. Read latest PROGRESS.md and docs/LOCAL-FIRST-CHAT.md for 50-test Mac evidence and limitations. Model estimates are not station observations. Primary web queries retain original trimmed text; retries remove only request scaffolding and preserve important details. News RSS and general HTML search remain available.

Start scripts/start-local-ai.sh and scripts/start-mac-chat.sh; open http://127.0.0.1:4173. Earlier authorized commits becabed/84b84dd are remote; newer feature/fix checkpoints remain local. The previous no-push restriction is superseded by the latest explicit push instruction; merging remains outside the requested scope. Other-platform acceptance and specialized forecasts/station observations remain.

# October 3 weather and latency completion

U.S. weather uses Fahrenheit at the API layer, including coordinates; other regions use CLDR weather units. The same Huihui Qwen3 8B v2 runs with one 8K context, preloading and ten-minute idle expiry. Flash Attention/q8_0 context cache and a 256 MiB saved-prompt-state cap keep memory usage bounded; the installed Ollama LaunchAgent and startup script match. The final complete suite passed 206 tests (four optional profiling/input-driven harnesses skipped), with normal memory pressure throughout sustained inference. See docs/WEATHER-LATENCY.md and its raw JSON for before/after timings. This work is authorized for commit and push to the existing GitHub branch.
