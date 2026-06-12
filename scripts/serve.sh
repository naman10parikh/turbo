#!/usr/bin/env bash
# Launch the turbo cockpit (CP123 Cluster G). Local-first, read-mostly; the chairman's eyes (D3/Q5).
# Node stdlib HTTP server (zero npm deps, no build) — turbo is a Node repo, so the "stdlib server"
# is Node's own node:http, not Python like the sentinel/talent-intel reference.
#
# Usage:  bash scripts/serve.sh            ->  http://localhost:7799
#         TURBO_WEB_PORT=8080 bash scripts/serve.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# The cockpit's brain-browser/ask-the-employee shell out to the built CLI; ensure dist/ exists.
if [ ! -f dist/cli/index.js ]; then
  echo "dist/cli/index.js missing — building (pnpm build)…" >&2
  pnpm build
fi

# The Eval view reads a cached result (turbo eval takes ~22s — too slow per-request). Refresh
# the cache once in the background if it's missing or older than the latest source change.
# Read-only: this runs `turbo eval` (the eval pyramid), never a build/scaffold/audit-of-a-tree.
if [ ! -f eval/eval-result.json ]; then
  echo "warming eval cache in the background (eval/eval-result.json)…" >&2
  ( node dist/cli/index.js eval --json > eval/eval-result.json 2>/dev/null || true ) &
fi

exec node web/server.mjs
