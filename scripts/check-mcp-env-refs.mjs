#!/usr/bin/env node
/**
 * check-mcp-env-refs (C14) — assert `.mcp.json` never hardcodes a secret.
 *
 * The threat: a literal credential pasted into an MCP server's `env` block (or anywhere in the file).
 * The contract (HARNESS-OVERRIDES §7 "no live keys — env refs only"):
 *   1. No real-key PREFIX anywhere in the file (sk-ant-, ghp_/gho_, sk_live_, xox[bap]-, AKIA…).
 *      Targeted prefixes only — NOT a brittle `[A-Za-z0-9_]{32,}` heuristic that false-fails on a
 *      legitimate long env-var name / packed module path / base64-ish config default.
 *   2. Every `env` string value (the only secret-bearing slot) is EITHER a `${...}` reference OR a
 *      manifestly-non-secret config literal (a relative/absolute path or a short flag) — a SECRET
 *      value must always be a `${...}` ref. `command`/`args` are exempt (package names / flags).
 *
 * Why not "every env value must literally be `^${...}$`"? The inherited config legitimately sets
 * non-secret config via env (`MEMORY_FILE_PATH: ./memory/MEMORY.md`, `VAULT_PATH: ./brain`) — those are
 * paths, not credentials. Forcing them through `${...}` would be cargo-cult. The real invariant is:
 * **nothing secret is ever a literal.** This script enforces that intent precisely and is cold-runnable.
 *
 * Exit 0 = clean; non-zero = a violation (printed). Run: node scripts/check-mcp-env-refs.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const mcpPath = join(here, "..", ".mcp.json");

/** Real-key prefixes (targeted — a literal secret of one of these shapes is a hard fail anywhere). */
const REAL_KEY_PREFIX = /(sk-ant-|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|sk_live_|xox[bap]-|AKIA[0-9A-Z]{16})/;

/** A `${VAR}` reference (optionally with surrounding whitespace). */
const ENV_REF = /^\s*\$\{[^}]+\}\s*$/;

/**
 * A non-secret config literal: a path (starts with ./ ../ / or ~), or a short flag/identifier that
 * obviously isn't a credential. Anything else that is a long opaque literal is treated as suspect.
 */
function isSafeConfigLiteral(v) {
  if (ENV_REF.test(v)) return true; // a ref is always safe
  if (/^(\.\/|\.\.\/|\/|~)/.test(v)) return true; // a path
  if (REAL_KEY_PREFIX.test(v)) return false; // a real-key shape is never safe
  // Short, low-entropy values (flags, ports, booleans, simple identifiers) are config, not secrets.
  if (v.length <= 24 && /^[A-Za-z0-9_.:/-]*$/.test(v)) return true;
  return false; // long opaque literal in an env slot → must be a ${...} ref
}

function fail(msg) {
  process.stderr.write(`✗ check-mcp-env-refs: ${msg}\n`);
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(mcpPath, "utf8");
} catch (e) {
  fail(`cannot read .mcp.json: ${e instanceof Error ? e.message : String(e)}`);
}

// 1) No real-key prefix anywhere in the raw file.
if (REAL_KEY_PREFIX.test(raw)) {
  fail(`a real-key prefix (sk-ant-/ghp_/gho_/sk_live_/xox*-/AKIA…) appears literally in .mcp.json`);
}

let cfg;
try {
  cfg = JSON.parse(raw);
} catch (e) {
  fail(`.mcp.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
}

const servers = cfg.mcpServers ?? {};
if (!servers.turbo) fail("`.mcp.json` is missing the OWN `turbo` server entry (C14)");

// 2) Every env string value is a ref or a safe config literal.
const violations = [];
for (const [name, server] of Object.entries(servers)) {
  const env = server?.env;
  if (!env || typeof env !== "object") continue;
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== "string") continue;
    if (!isSafeConfigLiteral(value)) {
      violations.push(`${name}.env.${key} is a literal that must be a \${...} ref (looks secret-bearing)`);
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) process.stderr.write(`  - ${v}\n`);
  fail(`${violations.length} env value(s) hardcode a potential secret — use \${...} refs`);
}

process.stdout.write(
  `✓ check-mcp-env-refs: turbo server present; no real-key prefixes; all env values are \${...} refs or safe config literals (${Object.keys(servers).length} servers)\n`,
);
