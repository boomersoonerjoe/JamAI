# JamAI

JamAI (formerly NhomeAI) is a private, local-first AI assistant. JamAI is the official product name as of October 5, 2026.

The primary client is the cross-platform web/PWA in `web/`, with local Ollama and optional browser-based inference, saved conversations and memories, and web retrieval.

## Run locally

From `web/`, run `pnpm build` and `pnpm start`, then open http://127.0.0.1:4173. See [local AI setup](docs/MAC-LOCAL-AI.md) and [automatic startup](docs/MAC-AUTOSTART.md).

## Rename compatibility

Existing `nhomeai.*` browser-storage keys, test environment variables, and `com.nhomeai.*` Mac service identifiers remain compatible. The workspace stays at `/Users/joesmac/Documents/NhomeAI` because the installed startup services use that path. Saved chats, memories, and settings remain available in the same browser profile and origin. Historical progress records retain the name used at the time.

The preserved Swift reference remains in `PocketAI/`.
