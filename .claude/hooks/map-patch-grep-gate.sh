#!/bin/bash
# map-patch-grep-gate.sh — PreToolUse(Write|Edit) law gate.
# Dogfood: flags the two 🔴 backend bugs turbo exists to kill, BEFORE they land:
#   P-02 — module-scope `new Map()`/`new Set()`/object-as-cache in app/api/** (racy
#          cross-request state under Vercel Fluid Compute — the S-01 data bleed).
#   P-04 — a defaulted create-schema reused/`.partial()`'d for a PATCH body
#          (Zod 4 `.default()` fires on undefined even under .partial() — S-02 data loss).
#
# Contract (Claude Code PreToolUse hook):
#   - stdin = JSON with .tool_name and .tool_input (.file_path + .content/.new_string)
#   - exit 0  => allow
#   - exit 2  => BLOCK (stderr shown to Claude)
# Every block is appended to the single canonical log: .claude/hooks/gate.log
#
# Wiring (see .claude/settings.json):
#   PreToolUse matcher "Write|Edit" -> this script.

set -uo pipefail

REPO_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
# TURBO_GATE_LOG lets the plugin keep its log out of the open project (hooks/hooks.json sets it).
GATE_LOG="${TURBO_GATE_LOG:-$REPO_DIR/.claude/hooks/gate.log}"
TS="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

PAYLOAD="$(cat 2>/dev/null || true)"

# Pull file_path + the written text (content for Write, new_string for Edit) out
# of the JSON payload. node is the reliable parser for multi-line content.
read_field() {
  local field="$1"
  if command -v node >/dev/null 2>&1; then
    # NOTE: FIELD must be exported on the *node* side of the pipe — setting it on
    # the `printf` process would not reach node (separate process), so we wrap the
    # node invocation in a subshell that owns the env var.
    printf '%s' "$PAYLOAD" | ( export FIELD="$field"; node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        try{const j=JSON.parse(s);const ti=j.tool_input||{};
          const f=process.env.FIELD;
          let v="";
          if(f==="file_path"){v=ti.file_path||"";}
          else{v=ti.content||ti.new_string||"";}
          process.stdout.write(String(v));
        }catch{process.stdout.write("");}
      });' ) 2>/dev/null
    return 0
  fi
  # jq fallback (handles multi-line via -r)
  if command -v jq >/dev/null 2>&1; then
    if [ "$field" = "file_path" ]; then
      printf '%s' "$PAYLOAD" | jq -r '.tool_input.file_path // empty' 2>/dev/null
    else
      printf '%s' "$PAYLOAD" | jq -r '.tool_input.content // .tool_input.new_string // empty' 2>/dev/null
    fi
    return 0
  fi
  printf ''
}

FILE_PATH="$(read_field file_path)"
CONTENT="$(read_field content)"

# Only gate .ts / .tsx writes. Anything else (md/json/sh) passes.
case "$FILE_PATH" in
  *.ts|*.tsx) : ;;
  *) exit 0 ;;
esac

REASON=""
DETAIL=""

# --- P-02: module-scope new Map()/Set()/object-as-cache in app/api/** ---
# Only enforce inside app/api/** (the serverless route surface where the race fires).
case "$FILE_PATH" in
  *app/api/*)
    # A `new Map()/Set()` (optionally generic-typed) bound at module scope — i.e. a
    # top-level `const/let X = new Map<...>()`/`= {}` used as a cache. We approximate
    # "module scope" as a line with no leading indentation (top-level statement).
    if printf '%s' "$CONTENT" | grep -Eq '^(const|let|var)[[:space:]]+[A-Za-z_$][A-Za-z0-9_$]*[[:space:]]*(:[^=]*)?=[[:space:]]*new[[:space:]]+(Map|Set)[[:space:]]*(<[^>]*>)?[[:space:]]*\('; then
      REASON="map-patch"
      DETAIL="P-02 module-scope new Map()/Set() in app/api/** (racy cross-request state — externalize or move into the handler)"
    fi
    ;;
esac

# --- P-04: a defaulted create-schema reused/.partial()'d for PATCH ---
# Heuristic: the written text contains a Zod schema with a `.default(` AND that same
# schema (a *Create*-named schema) is `.partial()`'d — the classic "reuse the create
# schema for the update body" data-loss shape.
if [ -z "$REASON" ]; then
  if printf '%s' "$CONTENT" | grep -Eq '\.default\(' \
     && printf '%s' "$CONTENT" | grep -Eq '[A-Za-z0-9_$]*(Create|create)[A-Za-z0-9_$]*Schema[[:space:]]*\.partial\(\)'; then
    REASON="map-patch"
    DETAIL="P-04 a defaulted create-schema is .partial()'d for PATCH (Zod 4 .default() fires on undefined even under .partial() — use a dedicated no-default PATCH schema)"
  fi
fi

if [ -n "$REASON" ]; then
  echo "[$TS] BLOCK $REASON: $FILE_PATH — $DETAIL" >> "$GATE_LOG"
  {
    echo "turbo law gate: BLOCKED write to $FILE_PATH"
    echo "$DETAIL"
    echo "Fix: see \`turbo explain ${DETAIL%% *}\` / the audit-serverless-state | zod-boundary-and-patch skill."
    echo "Logged to .claude/hooks/gate.log"
  } >&2
  exit 2
fi

exit 0
