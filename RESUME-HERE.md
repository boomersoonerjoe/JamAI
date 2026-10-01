# Current conversational-answer checkpoint

Remain on codex/cross-platform-foundation. The user forbids push/merge. Latest changes implement locally generated cited conversational sentences with exact quote/source validation, conservative news/name/number checks, one repair and partial supported-sentence retention. All 60 Mac checks passed (46 unit/HTTP + 14 live), production build passed. Read docs/LIVE-CHAT-VALIDATION.md for 12 live retrieval questions and honest limitations: prices/comparisons often absent, broad research snippets inadequate, no complete-page fetching. Weather/news sources and Qwen/Ollama remain free/local-first. Semantic validation reduces risk but does not formally prove every paraphrase.

Mac UI verified conversational weather and product replies. Start existing scripts/start-local-ai.sh and scripts/start-mac-chat.sh, connect at http://127.0.0.1:4173. Local runtime/model already installed. Earlier remote commits remain unchanged; newer work is local only. Other platforms and owner acceptance remain pending.

# Current weather-location checkpoint

Work remains local on codex/cross-platform-foundation; do not push or merge. Latest fix preserves general search details, rejects wrong-city weather results, and adds free noncommercial Open-Meteo current model weather for validated named locations with explicit resolved place/time/units and attribution. Qwen/Ollama remain local. Read latest PROGRESS.md and docs/LOCAL-FIRST-CHAT.md for 50-test Mac evidence and limitations. Model estimates are not station observations. Primary web queries retain original trimmed text; retries remove only request scaffolding and preserve important details. News RSS and general HTML search remain available.

Start scripts/start-local-ai.sh and scripts/start-mac-chat.sh; open http://127.0.0.1:4173. Earlier authorized commits becabed/84b84dd are remote; newer feature/fix checkpoints remain local. User explicitly forbids push/merge for this work. Other-platform acceptance and specialized forecasts/station observations remain.
