# PocketAI - AI Hand-Off & Project Progress Tracker

## Purpose
This file is the canonical hand-off record for AI-assisted development of PocketAI. Any model continuing development should read this file first, then inspect the latest commits, open pull requests, active feature branches, repository tree, and relevant source files. Update this file at every clean stopping point and before handing work to another model.

This workflow is intentionally model-agnostic. No AI provider or model needs to be listed here in advance to participate. Any capable AI model with appropriate repository access should follow the same continuation, branch, validation, and hand-off rules in this file.

## Continuation Rule
When the owner says **"continue build"**, the incoming model should automatically use this protocol:
1. Read `PROGRESS.md` from the repository's default branch first.
2. Inspect recent commits and any open PocketAI development pull requests/feature branches.
3. Determine the active development branch from the newest coherent hand-off information; do not assume `main` is the work branch.
4. Inspect the actual diff/source before trusting a summary from another model.
5. Continue the recorded immediate next step unless it is blocked, unsafe, conflicts with newer code, or requires an owner decision.
6. Never restart completed work merely because a different AI model is taking over.
7. Before stopping, leave the repository in a coherent state and update this file so the next model can resume without asking the owner to reconstruct context.

If `PROGRESS.md`, branch state, and actual code disagree, **the repository code and newest valid commits win**. Update this file to reconcile the discrepancy before continuing substantial work.

## Abrupt-Stop / Usage-Limit Recovery
Development must remain recoverable even if an AI session ends unexpectedly because of a usage limit, disconnect, tool failure, crash, or other interruption before a normal hand-off can be written.

During any substantive development session:
1. Create or resume the correct feature branch before making meaningful changes.
2. Commit small, coherent milestones frequently enough that another model can recover from GitHub without depending on the prior chat session.
3. Do not wait until the end of a long session to make the first useful commit.
4. For longer sessions, refresh `PROGRESS.md` or another clearly referenced hand-off note at natural checkpoints when practical, rather than relying only on a final end-of-session update.
5. Treat uncommitted or unpushed workspace changes as non-transferable. Another AI may not be able to see them, so important progress should reach GitHub promptly after it becomes coherent.

If an incoming model suspects the previous session ended abruptly:
1. Do not assume `PROGRESS.md` is fully current.
2. Inspect the newest commits, active feature branches, open pull requests, and diffs first.
3. Prefer the newest coherent repository state over an older hand-off summary.
4. Identify the last completed checkpoint and continue from there; do not reconstruct or redo work that is already present in GitHub.
5. If partial or contradictory changes make the intended next step unclear, stop and ask the owner rather than guessing.

Goal: after each meaningful checkpoint, the repository itself should contain enough information for a different AI model to resume safely even if the prior model disappeared without warning.

## Session Metadata
- Last Active Model: Codex
- Last Updated: 2026-10-01
- Canonical Hand-Off Location: `PROGRESS.md` on the default branch (`main`)
- Active Development Branch: `codex/cross-platform-foundation`
- Status: LOCAL WEBLLM CHAT IMPLEMENTED AND MAC BROWSER SMOKE TEST PASSED; PHYSICAL IPHONE ACCEPTANCE PENDING; APPLE V1 PRESERVED AT `395d298`
- Active Milestone: Version 1 - Cross-platform Chat

The actual Git branch HEAD is the authoritative latest commit. Do not hard-code a commit hash here as the permanent source of truth because updating this file creates another commit.

## Product Purpose and Scope
PocketAI is a private personal AI system for one owner only. It is not intended for App Store distribution, public users, or commercial SaaS operation.

Do not add public-product infrastructure unless the owner explicitly changes this requirement. Avoid unnecessary multi-user systems, customer billing, public onboarding, analytics, or public-scale architecture.

Privacy and security remain important. Prefer local/private behavior where practical. Network or server use should be intentional and visible.

### Version Roadmap
- V1 - Chat: finish a strong, usable personal chat assistant. This is the active milestone.
- V2 - Voice OR image generation: choose after V1 based on usefulness and available technology.
- V3 - Add whichever of voice/image was not selected for V2.
- V4 - Expansion: reassess desired features after real use.

Scope guard: do not expand image generation or voice chat during V1 unless required for compatibility or explicitly requested by the owner.

## Cross-Platform Requirement
NhomeAI must not be Apple-only. The primary product must support iPhone/iPad, Android, macOS, Windows, and Linux without requiring an Apple Developer Program subscription or recurring seven-day iOS re-signing. Apple Foundation Models and MLX may remain optional adapters, but cannot be required by the core product. The primary client direction is an installable PWA/web client with portable state and provider-neutral AI interfaces. See `docs/CROSS-PLATFORM-ARCHITECTURE.md`.

## Long-Term Architecture
Target direction:

`PocketAI client -> routing layer -> local engine OR private remote/server engine`

Design assumptions:
- iPhone, Mac, and other laptops may act as clients.
- Lightweight chat and personal-memory work should remain local when practical.
- Heavy work may later route to a VPS/private backend.
- The VPS should eventually be replaceable with the owner's physical AI server without rebuilding the client.
- Persistent personal memory is a core requirement.
- Remote/provider-specific details should stay behind stable interfaces so servers/providers can change later.

## Current Source State
Repository inspection shows substantial reusable V1 groundwork:
- SwiftUI app/project structure with app and test targets.
- `ChatEngine` abstraction for interchangeable chat backends.
- `AppleChatEngine` using Apple's on-device language-model APIs.
- `MLXChatEngine` for downloadable/local MLX models.
- Streaming responses, cancellation, bounded context, and engine status handling.
- Local conversation and memory persistence through app-owned JSON state.
- Downloadable model library with disk-space guard, staging, cancellation, pinned revisions, and integrity verification.
- Local model switching/loading infrastructure.
- Image storage groundwork exists, but image generation is not a V1 priority.
- XCTest source exists for model-library and persistence behavior.
- Build/test documentation and project-generation scripts are present.

IMPORTANT: implemented in source does not mean device-verified. Compilation, package resolution, XCTest execution, real-device behavior, offline execution, MLX performance, memory pressure, and thermal behavior still require Mac/iPhone validation unless later recorded as completed.

## Work Currently In Progress
The primary cross-platform PWA now runs Llama 3.2 1B Instruct 4-bit locally through WebLLM/WebGPU in a dedicated browser worker. Production build, strict TypeScript, and seven relevant tests pass. The Mac in-app browser successfully downloaded/loaded the real model, generated a response, recalled `7429` on a follow-up, and retained conversation history across page reload. These results do not establish physical-iPhone behavior.

The known-good Swift/Apple V1 remains unchanged. No paid service or remote inference has been enabled. Browser model assets require an initial download; retained caches are required for offline use. See `docs/LOCAL-AI-CHAT.md`.

## Immediate Next Steps for Incoming Model
1. Read this file and `docs/CROSS-PLATFORM-ARCHITECTURE.md`; inspect actual branch HEAD/source. Continue `codex/cross-platform-foundation`, never merge into `main` without owner instruction.
2. Serve the production `web/dist/` at a trusted HTTPS origin accessible to the physical iPhone. No deployment or paid hosting was performed. A Mac LAN HTTP address is insufficient for WebGPU secure context.
3. Execute all physical-iPhone checks in `docs/LOCAL-AI-CHAT.md`: first download/compile, real streaming/context, Stop/retry, persistence, Safari/Home Screen installation, airplane-mode cold launch/inference, cache retention, background/GPU-loss handling, keyboard/accessibility, memory/latency/battery/thermal behavior.
4. Fix reproduced browser/device issues. Automatic device-loss recovery and model-load cancellation are not implemented; reload the app to recreate a failed runtime. Keep provider neutrality and app-owned context.
5. Swift-state import/migration, memory-note editing, and user-facing model switching remain future work. Existing stored schema memory notes are included in the bounded prompt. Do not add voice/image/remote features during local-chat acceptance.
6. Preserve Swift/Apple V1 and its recorded simulator gate. Do not extrapolate Mac/browser results to iPhone. Do not purchase or enable paid services.
7. Commit/push coherent changes on the active feature branch and update this hand-off with exact validation and remaining work.

## Architectural Decisions and Guardrails
- Single-user/private: optimize for one owner, not a public product.
- V1 is chat only: voice and image-generation feature development are deferred.
- Local-first where practical: remote use should be intentional.
- Hybrid-ready: keep local and remote engines behind stable interfaces.
- Server replaceability: avoid client dependence on one VPS vendor or inference provider.
- Persistent memory: preserve and evolve the existing app-owned memory/persistence layer.
- No unapproved spending: paid services require explicit owner approval.
- Preserve working code: do not restart PocketAI merely because another architecture is possible.
- Source vs. verified: distinguish code that exists from behavior proven by builds/tests/devices.
- Cross-model continuity: any incoming AI model should continue the same project history rather than create provider- or model-specific forks unless a deliberate experiment requires one.
- Model neutrality: the workflow applies equally to current and future AI assistants; naming a model in session history records who worked last but does not grant special status or create a separate workflow.
- Crash recoverability: meaningful progress should be committed to GitHub in small coherent checkpoints so an abrupt session end does not strand important work in one model's temporary workspace.

## Validation Status
### Present in source
- Project structure
- Chat abstractions
- Apple local chat adapter
- MLX local chat adapter
- Persistence/memory source
- Model download/integrity source
- XCTest source

### Mac / Xcode Validation Queue
Mark PASS/FAIL only after actual execution:
- [x] Resolve Swift packages in Xcode (pinned products resolved).
- [x] Compile the PocketAI app target for iOS Simulator.
- [x] Compile and run the XCTest suite (19 passed, including real Apple-model streaming/context/persistence).
- [x] Manual simulator chat acceptance: owner verified launch, new conversation, local AI response, and follow-up recall of `7429` on iPhone 18 Pro.
- [ ] Inspect remaining primary screens and physical-device keyboard/accessibility layouts.
- [ ] Verify conversation/memory persistence across relaunch.
- [ ] Test Apple on-device chat availability, streaming, and cancellation where supported.
- [ ] Test MLX model download, verification, load, generation, cancellation, and deletion.
- [ ] Verify real offline chat after required model assets are installed.
- [ ] Measure practical memory, thermal, and performance behavior on the target iPhone.

### Quick Repository References
- Roadmap: `docs/ROADMAP.md`
- Build/test notes: `docs/BUILD-AND-TEST.md`
- Core chat: `PocketAI/ChatEngine.swift`
- MLX chat: `PocketAI/MLXChatEngine.swift`
- App state/orchestration: `PocketAI/AppStore.swift`
- Persistence models: `PocketAI/Models.swift`
- Local model management: `PocketAI/ModelLibrary.swift`

## Current Blockers / Owner Decisions Needed
Physical-iPhone hardware and a trusted HTTPS app origin are needed for device acceptance. No production site was deployed during this milestone. WebGPU presence alone does not guarantee model GPU capability or sufficient iPhone memory. Offline generation and browser cache retention are not yet verified. The historical Apple/MLX physical-device acceptance queue remains pending and separate from the primary PWA milestone.

## Mandatory End-of-Session Hand-Off
Before another model takes over or a development session ends:
1. Stop at the smallest coherent development milestone possible.
2. Inspect the diff for accidental or unrelated changes.
3. Run every test/build actually available in the current environment. Never report a test as passed if it was not run.
4. Make small, descriptive commits on the feature branch.
5. Update this file with model/date, active branch/status, exact work completed, materially changed files, validation actually performed and results, unfinished work, blockers, exact next steps, and any Mac/Xcode/device validation required.
6. Ensure the canonical `PROGRESS.md` on `main` is updated through the normal merge/PR workflow at an appropriate stopping point so the next model can discover it immediately.
7. The incoming model reads this file and independently inspects the latest commit/diff before continuing.

If the session ends before these steps can be completed, the Abrupt-Stop / Usage-Limit Recovery rules above take precedence for the next model.

### Recommended Incoming-Model Prompt
> Continue build. Read `PROGRESS.md` from `main` first, inspect the newest commits and active development PR/branch, then continue the recorded PocketAI V1 task from the actual repository state. Preserve the documented architecture and scope. Do not restart completed work, work directly on `main` for unfinished features, make spending decisions, or report builds/tests/device behavior as verified unless they were actually run. If the prior session appears to have ended abruptly, reconstruct the latest safe checkpoint from GitHub before continuing.

## Session Log
### 2026-10-01 - Codex local browser AI chat
- Installed pinned `@mlc-ai/web-llm` 0.2.82 plus Vitest and React types; updated the pnpm lockfile. Added strict TypeScript checking to the production build.
- Replaced the placeholder with provider-neutral lifecycle/status interfaces and a WebLLM adapter. Default model is `Llama-3.2-1B-Instruct-q4f16_1-MLC`; dedicated worker handles on-device WebGPU inference. No Mac server or cloud inference API is used.
- Implemented explicit model loading with progress/error/retry UI, real streaming and persisted assistant messages, Stop and response retry, request serialization, bounded context reuse, and engine-history reset per request. UI chat switching is locked during generation.
- Added a build-generated versioned offline shell service worker, production registration, mobile safe-area/input/streamed-text styling, architecture update, and detailed runtime/device acceptance notes in `docs/LOCAL-AI-CHAT.md`.
- Validation: `pnpm run build` PASS (strict TypeScript, Vite 7.3.6, 34 modules, offline shell with 6 assets); `pnpm test` PASS (7 tests: model selection/loading deduplication, unsupported browser, load retry, streaming/context reset, cancellation/retry, concurrency, bounded UTF-8 context). Build reports expected large WebLLM runtime chunks (about 6 MB each for worker/main runtime); no build errors.
- Real Mac in-app-browser production-preview smoke test PASS: actual model download/load, response `7429.`, follow-up `You asked me to remember the number 7429.`, conversation retained across reload. No browser console errors/warnings were reported at model-ready inspection. This was real WebGPU inference, not the fake test runtime.
- Physical iPhone, Safari/Home Screen behavior, airplane-mode inference, cache survival, background/GPU-loss recovery, peak memory, performance/thermal/battery, and accessibility remain unverified. Automatic device-loss recovery/load cancellation, Swift-state import, and memory editing/model-picker UI are not implemented.
- Only `web/`, cross-platform docs, and this hand-off changed. Swift/Apple V1 remains intact; no main merge or paid service activation.

### 2026-10-01 - Codex cross-platform production build
- Fetched origin and checked out `codex/cross-platform-foundation`, tracking the remote branch; confirmed `395d298` is an ancestor.
- Read this hand-off and `docs/CROSS-PLATFORM-ARCHITECTURE.md` before changes.
- Installed `web/` dependencies with bundled Node/pnpm because Node/npm were absent from the shell PATH. Added `web/pnpm-lock.yaml` and explicit esbuild install-script approval in `web/pnpm-workspace.yaml`.
- Production validation: `pnpm run build` passed with Vite 7.3.6 (27 modules). No build errors or application-source fixes were required.
- Added ignore rules for web dependencies, production output, and the local pnpm store. Existing Swift/Apple V1 code is unchanged; no merge into `main` was performed.
- Browser/device runtime behavior remains unverified. Next development step is the first real local cross-platform chat provider/runtime and state migration/import; this session only validated the production build.

### 2026-10-01 - ChatGPT cross-platform migration
- Confirmed `boomersoonerjoe/My-AI-App` is the NhomeAI/PocketAI repository by locating known-good commit `395d298`.
- Created `codex/cross-platform-foundation` from that exact checkpoint; did not modify `main`.
- Added `web/` installable-PWA foundation with responsive chat UI, schema-v1 conversation/memory/image-draft types, local browser persistence, bounded context construction matching Swift V1 semantics, and a provider-neutral `ChatProvider` boundary.
- Added `docs/CROSS-PLATFORM-ARCHITECTURE.md`. Existing Swift/Xcode/Apple/MLX code remains intact as tested reference/optional adapter code.
- No paid service was connected. No Apple Developer membership is required by the target architecture.
- Validation: repository structure/source inspected; browser build has NOT yet been executed in this connector-only session. Next step is to run `npm install && npm run build` in `web/`, then implement the first real local cross-platform chat provider/runtime and state migration/import.

### 2026-09-30 - Codex / owner manual acceptance
- Resolved and compiled MLXLLM, MLXLMCommon, MLXHuggingFace, and Tokenizers at the existing pinned versions. Fixed the Debug app/package architecture mismatch with `ONLY_ACTIVE_ARCH = YES` and preserved it in the generator.
- Disabled chat save/send controls while model switching; rejected unsupported MLX simulator loading with an actionable error.
- Generic simulator build passed. All 19 XCTest cases passed on iPhone 18 Pro/iOS 27.0, including real Apple-model streaming, follow-up recall, and persistence when reopening the store.
- Owner manually passed on-screen V1 chat: launch, conversation creation, local response, remember `7429`, follow-up correctly answered `7429`. Treat this gate as complete; do not repeat it solely because Device Hub automation timed out.
- Updated build notes, roadmap, and canonical progress. No new features added. Physical-device/offline/Memory-note/relaunch/MLX/performance acceptance remains as listed above.
- Checkpointed session changes on `codex/v1-local-chat-validation` at the owner's request; no GitHub push, merge into `main`, or device signing/install was performed. Read the branch HEAD for the commit identity.

### 2026-09-13 - ChatGPT (GPT-5.6 Sol)
- Created and refined the PocketAI-specific hand-off framework for cross-model continuity.
- Replaced generic Node/JWT examples with PocketAI's actual architecture and V1 scope.
- Recorded the single-user/private requirement and V1 through V4 roadmap.
- Added an explicit `continue build` protocol so any incoming AI model follows the same continuation path.
- Made the hand-off workflow explicitly model-agnostic so future AI models do not need to be named in advance.
- Added abrupt-stop / usage-limit recovery rules so another model can recover from the latest coherent GitHub checkpoint if a session ends unexpectedly.
- Made `PROGRESS.md` on `main` the canonical discovery point while keeping unfinished development on feature branches.
- Recorded the distinction between source implementation and Mac/iPhone validation.
- Added hand-off, small-commit, no-main-feature-development, and no-unverified-test rules.
- Code behavior changed: No.
- Builds/tests run: None; documentation-only change.
