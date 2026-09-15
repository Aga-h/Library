#!/bin/bash
# SessionStart hook.
#
# Two jobs:
#   1. Make the container usable — Claude Code on the web starts from a fresh clone with no
#      node_modules, so builds/lint/typecheck all fail for the wrong reason until deps exist.
#   2. Emit .claude/PROGRESS.md. SessionStart stdout lands in the session context, so a new
#      session opens already knowing where the last one stopped.
#
# Must stay idempotent and non-interactive.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Local machines already have their dependencies; only the remote container needs this.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if [ -f "$PROJECT_DIR/package.json" ]; then
    # `install`, not `ci` — reuses the cached container state instead of wiping node_modules.
    npm install --prefix "$PROJECT_DIR" --no-audit --no-fund >/dev/null 2>&1 || {
      echo "NOTE: npm install failed during session start. Run it manually before building." >&2
    }
  fi
fi

if [ -f "$PROJECT_DIR/.claude/PROGRESS.md" ]; then
  echo "=== Resuming work — state from .claude/PROGRESS.md ==="
  cat "$PROJECT_DIR/.claude/PROGRESS.md"
  echo "=== end of saved state ==="
fi
