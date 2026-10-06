#!/bin/zsh
set -eu
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_NO_CLOUD=1
export OLLAMA_MODELS="$PROJECT_DIR/.local-ai/models"
export OLLAMA_CONTEXT_LENGTH=8192
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=q8_0
# Bound saved prompt-state RAM on a 16 GB Mac; active context stays at 8K.
export LLAMA_ARG_CACHE_RAM=256
export OLLAMA_NUM_PARALLEL=1
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_ORIGINS=http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:5173,http://localhost:5173
RUNTIME="$PROJECT_DIR/.local-ai/runtime/ollama"
if [[ ! -x "$RUNTIME" ]]; then
  RUNTIME="$(command -v ollama || true)"
fi
if [[ -z "$RUNTIME" ]]; then
  print -u2 'Ollama is missing. See docs/MAC-LOCAL-AI.md.'
  exit 1
fi
exec "$RUNTIME" serve
