# NhomeAI cross-platform architecture

## Product requirement
NhomeAI is a private, single-owner AI system. Its core product must work on iPhone/iPad, Android, macOS, Windows, and Linux without requiring an Apple Developer Program subscription or recurring iOS re-signing.

## Architecture
1. **Portable client:** `web/` is the primary cross-platform UI/PWA.
2. **Portable state:** conversations, memories, and image-draft concepts retain schema-v1 semantics from the tested Swift implementation.
3. **Provider boundary:** the client talks to a `ChatProvider`; UI/storage must not depend on Apple Foundation Models, MLX, or any cloud vendor.
4. **Local/private runtimes:** future providers may target a local service on the same computer, a trusted NhomeAI node on the LAN (for example the owner's Mac), or an explicitly configured private remote GPU/backend.
5. **Apple adapter:** the existing Swift/Apple implementation remains preserved as tested reference code and may later serve as an optional Apple-native adapter. It is not the required NhomeAI client.
6. **Installability:** the web client is designed as a PWA so supported browsers can install it to the home screen/desktop without App Store distribution.

## Migration sequence
- Phase A: portable PWA shell, schema, persistence, prompt/context behavior, provider interface.
- Phase B: implement a local cross-platform chat runtime/provider and streaming transport.
- Phase C: import/migrate existing PocketAI state and validate chat/memory parity.
- Phase D: add optional LAN node discovery/configuration so phones can use stronger Mac/PC AI when desired.
- Phase E: image provider, then voice/video according to the product roadmap.

## Guardrails
- No paid service is added without owner approval.
- No platform-specific model is a required dependency.
- Local/private operation is preferred.
- Existing known-good Swift V1 is preserved until replacement behavior is validated.
