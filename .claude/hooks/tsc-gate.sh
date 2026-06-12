#!/bin/bash
# tsc-gate.sh — PreToolUse(Bash) commit gate.
# Dogfood: turbo's harness obeys turbo's own law. Blocks a `git commit` if
# `tsc --noEmit` fails (enforces O-09 / P-09 — native strip-types does NOT
# type-check, so the energy "no any" law needs this gate explicitly).
#
# Contract (Claude Code PreToolUse hook):
#   - stdin = JSON with .tool_name and .tool_input.command (for Bash)
#   - exit 0  => allow
#   - exit 2  => BLOCK (stderr is shown to Claude)
# Every block is appended to the single canonical log: .claude/hooks/gate.log
#
# Wiring (see .claude/settings.json):
#   PreToolUse matcher "Bash" -> this script.

set -uo pipefail

REPO_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
GATE_LOG="$REPO_DIR/.claude/hooks/gate.log"
TS="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# Read the hook payload from stdin (JSON). Fall back to env for manual testing.
PAYLOAD="$(cat 2>/dev/null || true)"

extract_command() {
  # Prefer jq; fall back to a node one-liner; finally the raw env var.
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // empty' 2>/dev/null && return 0
  fi
  if command -v node >/dev/null 2>&1; then
    printf '%s' "$PAYLOAD" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.command)||"")}catch{process.stdout.write("")}})' 2>/dev/null && return 0
  fi
  printf '%s' "${CLAUDE_TOOL_INPUT_COMMAND:-}"
}

CMD="$(extract_command)"

# Only gate actual git commits. Everything else passes untouched.
if ! printf '%s' "$CMD" | grep -Eq '\bgit\b[^;&|]*\bcommit\b'; then
  exit 0
fi

# Need a TS project to type-check. If there's no tsconfig, don't block.
if [ ! -f "$REPO_DIR/tsconfig.json" ]; then
  exit 0
fi

# Run the law gate. Prefer the repo's own tsc; fall back to npx.
cd "$REPO_DIR" || exit 0
if [ -x "$REPO_DIR/node_modules/.bin/tsc" ]; then
  TSC_OUT="$("$REPO_DIR/node_modules/.bin/tsc" --noEmit 2>&1)"
  TSC_RC=$?
elif command -v npx >/dev/null 2>&1; then
  TSC_OUT="$(npx --no-install tsc --noEmit 2>&1)"
  TSC_RC=$?
else
  # No type-checker available — cannot enforce; allow rather than false-block.
  exit 0
fi

if [ "$TSC_RC" -ne 0 ]; then
  FIRST_ERR="$(printf '%s' "$TSC_OUT" | grep -E 'error TS' | head -1)"
  echo "[$TS] BLOCK tsc-fail: git commit blocked — tsc --noEmit failed. ${FIRST_ERR}" >> "$GATE_LOG"
  {
    echo "turbo law gate: BLOCKED commit — \`tsc --noEmit\` failed (O-09/P-09)."
    echo "Native strip-types does NOT type-check; the energy 'no any' law needs tsc."
    echo "First error: ${FIRST_ERR:-<see tsc output>}"
    echo "Fix the type error, then commit. Logged to .claude/hooks/gate.log"
  } >&2
  exit 2
fi

exit 0
