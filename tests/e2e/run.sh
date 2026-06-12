#!/usr/bin/env bash
# Run the turbo cockpit + CLI-acceptance E2E (CP123 Cluster G / G29).
#
# Playwright is NOT a turbo dependency (zero-dep backend tool; no lockfile churn — PLAN §7). The
# specs run through the *already-installed* Playwright on the box: we point NODE_PATH at the shared
# toolchain so `@playwright/test` resolves, then run `npx playwright test`. The cockpit is booted
# automatically by playwright.config.ts's `webServer` block.
#
# Usage:  bash tests/e2e/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

# dist/ must exist — the cockpit + the CLI-acceptance spec both shell out to dist/cli/index.js.
[ -f dist/cli/index.js ] || pnpm build

# The eval-view spec asserts the 13-task grid, which reads the cached eval result. Build it
# SYNCHRONOUSLY here (the cockpit warms it async on serve, but the E2E must be deterministic —
# it can't race a ~22s background warm). ~22s one-time; skipped if already present.
[ -f eval/eval-result.json ] || node dist/cli/index.js eval --json > eval/eval-result.json 2>/dev/null

# Playwright is the globally-installed `playwright` package (this box: /usr/local/lib/node_modules).
# The specs import `@playwright/test` (the runner package), which isn't installed standalone — the
# global `playwright` re-exports it via test.mjs. Create an idempotent local shim in node_modules
# (gitignored — node_modules is never committed) so ESM resolves `@playwright/test` from this repo
# WITHOUT adding a turbo dependency or touching the lockfile (PLAN §7 zero-dep).
GLOBAL_NM="${TURBO_GLOBAL_NM:-/usr/local/lib/node_modules}"
if [ ! -f "$GLOBAL_NM/playwright/test.mjs" ]; then
  echo "Playwright not found at $GLOBAL_NM/playwright — install with: npm i -g playwright (or set TURBO_GLOBAL_NM)" >&2
  exit 1
fi
mkdir -p node_modules/@playwright/test
ln -sfn "$GLOBAL_NM/playwright" node_modules/playwright
cat > node_modules/@playwright/test/package.json <<EOF
{ "name": "@playwright/test", "version": "1.58.2", "type": "commonjs",
  "main": "index.js", "exports": { ".": { "import": "./index.mjs", "require": "./index.js" } } }
EOF
printf "export * from '%s/playwright/test.mjs';\n" "$GLOBAL_NM" > node_modules/@playwright/test/index.mjs
printf "module.exports = require('%s/playwright/test.js');\n" "$GLOBAL_NM" > node_modules/@playwright/test/index.js

exec node "$GLOBAL_NM/playwright/cli.js" test --config=playwright.config.ts "$@"
