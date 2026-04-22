#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:?CLAUDE_PLUGIN_ROOT is not set}"
ORCH_DIR="${PLUGIN_ROOT}/orchestrator"

# 1. Install dependencies if missing
if [ ! -d "${ORCH_DIR}/node_modules" ]; then
  echo "[FDE-AGENT] Installing orchestrator dependencies..."
  (cd "${ORCH_DIR}" && npm install)
fi

# 2. Build orchestrator (always — tsc is fast and dist/ can drift from src/)
echo "[FDE-AGENT] Building orchestrator..."
(cd "${ORCH_DIR}" && npm run build)

# 3. Run orchestrator, forwarding all arguments
exec node "${ORCH_DIR}/dist/index.js" "$@"
