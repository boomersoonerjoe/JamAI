#!/bin/zsh
set -eu
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# Use an installed Node first, with the Codex bundled runtime as a local fallback.
if ! command -v node >/dev/null; then
  NODE_DIR="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
  export PATH="$NODE_DIR:$PATH"
fi
cd "$PROJECT_DIR/web"
exec pnpm run preview --host 127.0.0.1 --port 4173 --strictPort
