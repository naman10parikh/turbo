#!/usr/bin/env node
/**
 * chaos smoke (Wave T — PLAN §9 "Chaos" row, cold-runnable). The chaos layer was the pyramid gap:
 * the failure-handling behavior exists in source (atomic `writeTree`, typed-Result parse, offline-safe
 * `check`) but had ZERO test. This suite exercises the three CLI-process chaos cases the §9 contract
 * names, each asserting the *law*: a failure surfaces as a typed Result / clean degrade, never a
 * throw/crash and never a half-written tree reported as success.
 *
 * §9 case (4) — the SSE in-stream-error → `event:error` frame — is enforced by the eval pyramid (G7,
 * CI-blocking, pass^k): `turbo stream-doctor` reports P-10/P-11 on a route missing the 3rd-arg handler.
 * We do NOT re-test it here (it's a generator/detector behavior, not a CLI-process failure mode); we
 * assert its presence-as-a-gate at the end so this file documents the full §9 coverage in one place.
 *
 * Each case is written so it FAILS RED if the invariant breaks:
 *   1. kill mid-run    → if `writeTree` stopped being atomic, a half `<out>` (no package.json) appears → FAIL.
 *   2. corrupt input   → if parse threw instead of returning a typed err, stdout wouldn't be `{ok:false}` → FAIL.
 *   3. no-network      → if `check` hung, the wall-clock guard trips; if it crashed, rc≠0 → FAIL.
 *
 * Exit 0 on pass, non-zero on the first failure. No network needed (case 3 forces offline via a dead
 * proxy). No secrets.   Run: node src/chaos/chaos.smoke.mjs   (after `pnpm build`)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeTree } from "../../dist/generator/write-tree.js";

const here = dirname(fileURLToPath(import.meta.url)); // src/chaos
const REPO = join(here, "..", "..");
const CLI = join(REPO, "dist", "cli", "index.js");
const FIXTURE = join(REPO, "eval", "fixtures", "petstore.openapi.json");

function fail(msg) {
  process.stderr.write(`✗ chaos smoke: ${msg}\n`);
  process.exit(1);
}

if (!existsSync(CLI)) fail(`dist/ not built — run \`pnpm build\` first (missing ${CLI})`);

// ── Case 1a — KILL MID-RUN (hermetic, the regression-detector): force a mid-write failure inside
//    `writeTree` and assert the law — a typed err Result + the final <out> NEVER left half-written.
//    A real SIGKILL's race window is sub-millisecond (12 tiny files → rename), so a kill almost never
//    lands mid-write on any given machine; THIS deterministic test is what goes RED if writeTree stops
//    being atomic-or-cleaned. (Verified: a naive non-atomic writeTree leaves a half <out> → FAIL.) ──
{
  const base = mkdtempSync(join(tmpdir(), "turbo-chaos-wt-"));
  // `a.ts` is written as a FILE; `a.ts/b.ts` then needs `a.ts` to be a dir → mkdirSync throws mid-write
  // (a deterministic, machine-independent forced failure — no null bytes, no timing).
  const out = join(base, "svc");
  const r = writeTree(out, new Map([["a.ts", "x"], ["a.ts/b.ts", "y"]]));
  if (r.ok !== false) fail(`KILL MID-RUN (hermetic): a forced mid-write failure did NOT return a typed err Result (got ok=${r.ok})`);
  if (typeof r.error !== "string" || r.error.length === 0) fail(`KILL MID-RUN (hermetic): expected a typed string error, got ${JSON.stringify(r.error)}`);
  if (existsSync(out)) fail(`KILL MID-RUN (hermetic): a half-written <out> survived a mid-write failure — writeTree is not atomic-or-cleaned`);
  // Positive control: a CLEAN writeTree produces a complete tree atomically.
  const okOut = join(base, "svc-ok");
  const okR = writeTree(okOut, new Map([["a.ts", "x"], ["sub/b.ts", "y"]]));
  if (okR.ok !== true || !existsSync(join(okOut, "a.ts")) || !existsSync(join(okOut, "sub", "b.ts"))) fail(`KILL MID-RUN (hermetic) control: a clean writeTree did not produce a complete tree`);
  process.stdout.write(`✓ KILL MID-RUN (hermetic): forced mid-write failure → typed err + NO half <out> (atomic-or-cleaned); clean write → complete tree\n`);
}

// ── Case 1b — KILL MID-RUN (real process): SIGKILL `turbo api` across a spread of timings; the final
//    <out> dir must NEVER be a half tree (the real §9 scenario — a process killed mid-generation). ──
{
  /** Spawn a generate, SIGKILL after `delayMs`, resolve the post-kill state of <out>. */
  function killAt(delayMs) {
    return new Promise((resolve) => {
      const base = mkdtempSync(join(tmpdir(), "turbo-chaos-kill-"));
      const out = join(base, "svc");
      const child = spawn(process.execPath, [CLI, "api", "--spec", FIXTURE, "--out", out, "--json"], { stdio: "ignore" });
      let killed = false;
      const t = setTimeout(() => {
        killed = true;
        try { child.kill("SIGKILL"); } catch { /* already gone */ }
      }, delayMs);
      child.on("close", () => {
        clearTimeout(t);
        const finalExists = existsSync(out);
        const complete = finalExists && existsSync(join(out, "package.json"));
        resolve({ delayMs, killed, finalExists, complete, halfTree: finalExists && !complete });
      });
    });
  }

  const timings = [0, 1, 2, 3, 5, 8, 13];
  const results = [];
  for (const d of timings) results.push(await killAt(d)); // eslint-disable-line no-await-in-loop
  const half = results.find((r) => r.halfTree);
  if (half) fail(`KILL MID-RUN: a half-written <out> (no package.json) was left after a kill at ${half.delayMs}ms — writeTree is not atomic`);
  // The invariant must have actually been exercised — at least one kill must have landed.
  if (!results.some((r) => r.killed)) fail(`KILL MID-RUN: no kill landed across ${timings.join("/")}ms — test did not exercise the boundary`);
  process.stdout.write(`✓ KILL MID-RUN: ${results.length} SIGKILLs across ${timings[0]}–${timings[timings.length - 1]}ms — no half <out> ever (atomic rename holds)\n`);

  // Positive control: an UN-killed run produces a COMPLETE tree (proves the atomic flip does fire).
  const base = mkdtempSync(join(tmpdir(), "turbo-chaos-ok-"));
  const out = join(base, "svc");
  const r = spawnSync(process.execPath, [CLI, "api", "--spec", FIXTURE, "--out", out, "--json"], { encoding: "utf8" });
  if (r.status !== 0 || !existsSync(join(out, "package.json"))) fail(`KILL MID-RUN control: an un-killed generate did not complete (rc=${r.status})`);
  process.stdout.write(`✓ KILL MID-RUN control: an un-killed generate produced a complete tree (the atomic flip fires)\n`);
}

// ── Case 2 — CORRUPT INPUT: a malformed spec AND a valid-but-empty spec must each return a typed
//    Result error on stdout (`{ok:false, error}`), exit non-zero, and write NO output tree (no throw). ─
{
  /** Run `turbo api` on a spec, capturing stdout/stderr separately (the --json contract is on stdout). */
  function genCorrupt(specBody, label) {
    const base = mkdtempSync(join(tmpdir(), `turbo-chaos-corrupt-${label}-`));
    const spec = join(base, "spec.json");
    const out = join(base, "out");
    writeFileSync(spec, specBody, "utf8");
    const r = spawnSync(process.execPath, [CLI, "api", "--spec", spec, "--out", out, "--json"], { encoding: "utf8" });
    return { r, out };
  }

  // (a) Malformed JSON — the external parser throws; the boundary must convert it to a typed err.
  {
    const { r, out } = genCorrupt('{ "openapi": "3.0.0", "info": { broken', "malformed");
    if (r.status === 0) fail(`CORRUPT (malformed): expected non-zero exit, got 0`);
    let body;
    try { body = JSON.parse(r.stdout.trim()); } catch { fail(`CORRUPT (malformed): stdout was not the {ok:false} --json contract: ${r.stdout.slice(0, 120)}`); }
    if (body.ok !== false || typeof body.error !== "string" || body.error.length === 0) fail(`CORRUPT (malformed): expected {ok:false, error:<string>}, got ${JSON.stringify(body).slice(0, 120)}`);
    if (existsSync(out)) fail(`CORRUPT (malformed): a tree was written for an unparseable spec`);
    process.stdout.write(`✓ CORRUPT INPUT (malformed JSON): typed {ok:false} on stdout, rc=${r.status}, no tree written (no crash)\n`);
  }

  // (b) Valid OpenAPI but zero operations — an un-representable input the IR walk must reject typed.
  {
    const { r, out } = genCorrupt('{ "openapi": "3.0.0", "info": {"title":"x","version":"1"}, "paths": {} }', "empty");
    if (r.status === 0) fail(`CORRUPT (empty): expected non-zero exit, got 0`);
    let body;
    try { body = JSON.parse(r.stdout.trim()); } catch { fail(`CORRUPT (empty): stdout was not the {ok:false} --json contract: ${r.stdout.slice(0, 120)}`); }
    if (body.ok !== false || typeof body.error !== "string") fail(`CORRUPT (empty): expected {ok:false, error}, got ${JSON.stringify(body).slice(0, 120)}`);
    if (existsSync(out)) fail(`CORRUPT (empty): a tree was written for a no-operations spec`);
    process.stdout.write(`✓ CORRUPT INPUT (no operations): typed {ok:false} "${body.error.slice(0, 48)}", rc=${r.status}, no tree (no crash)\n`);
  }
}

// ── Case 3 — NO-NETWORK: `turbo check` with the network blackholed must degrade to the local pin
//    table (`online:false`), exit 0, and NOT hang (a wall-clock guard catches a hang). ───────────────
{
  const start = Date.now();
  const HANG_BUDGET_MS = 30_000; // generous; the real path returns in ~2s. A hang would blow past this.
  const r = spawnSync(process.execPath, [CLI, "check", "--json"], {
    encoding: "utf8",
    timeout: HANG_BUDGET_MS,
    // Blackhole every outbound HTTP(S) to a dead local port → the npm-view path must fall back offline.
    env: { ...process.env, HTTP_PROXY: "http://127.0.0.1:1", HTTPS_PROXY: "http://127.0.0.1:1", NO_PROXY: "" },
  });
  const elapsed = Date.now() - start;
  if (r.signal === "SIGTERM" || elapsed >= HANG_BUDGET_MS) fail(`NO-NETWORK: \`turbo check\` HUNG (${elapsed}ms ≥ ${HANG_BUDGET_MS}ms budget) — offline path must not block`);
  if (r.status !== 0) fail(`NO-NETWORK: \`turbo check\` crashed offline (rc=${r.status}): ${(r.stderr || "").slice(0, 160)}`);
  let body;
  try { body = JSON.parse(r.stdout.trim()); } catch { fail(`NO-NETWORK: stdout was not parseable --json: ${r.stdout.slice(0, 120)}`); }
  if (body.online !== false) fail(`NO-NETWORK: expected online:false (local-table fallback), got online:${body.online}`);
  if (!Array.isArray(body.findings) || body.findings.length === 0) fail(`NO-NETWORK: offline fallback returned no findings (the local pin table is empty?)`);
  process.stdout.write(`✓ NO-NETWORK: \`turbo check\` degraded to the local table (online:false, ${body.findings.length} findings) in ${elapsed}ms, rc=0 (no hang, no crash)\n`);
}

// ── Case 4 (documented, enforced elsewhere) — SSE in-stream error → `event:error` frame. The §9 chaos
//    contract routes this to the eval pyramid (G7, CI-blocking, pass^k): `turbo stream-doctor` must flag
//    a route MISSING the 3rd-arg handler (P-11) / `X-Accel-Buffering: no` (P-10). We assert the gate
//    EXISTS and fires so this file documents the complete §9 coverage; the pass^k behavior is G7's. ──
{
  const base = mkdtempSync(join(tmpdir(), "turbo-chaos-sse-"));
  const bad = join(base, "bad-stream.ts");
  // A streaming route with NEITHER guard — the broken SETUP from S-08 (no 3rd-arg handler, no X-Accel).
  writeFileSync(
    bad,
    "import { streamSSE } from 'hono/streaming';\n" +
      "app.get('/stream', (c) => streamSSE(c, async (stream) => { await stream.writeSSE({ data: 'x' }); }));\n",
    "utf8",
  );
  const r = spawnSync(process.execPath, [CLI, "stream-doctor", bad, "--json"], { encoding: "utf8" });
  if (r.status !== 0) fail(`SSE gate: stream-doctor crashed (rc=${r.status}): ${(r.stderr || "").slice(0, 160)}`);
  let body;
  try { body = JSON.parse(r.stdout.trim()); } catch { fail(`SSE gate: stream-doctor stdout not --json: ${r.stdout.slice(0, 120)}`); }
  const ids = Array.isArray(body.traps) ? body.traps.map((t) => t.pitfall) : [];
  if (!ids.includes("P-11")) fail(`SSE gate: expected P-11 (missing 3rd-arg error handler → no event:error frame) on a bare streamSSE route; got [${ids.join(",")}]`);
  process.stdout.write(`✓ SSE in-stream-error gate (G7/S-08): stream-doctor flags ${ids.join("+")} on a bare streamSSE route (event:error-frame gap caught; pass^k is G7's)\n`);
}

process.stdout.write("\n✓ chaos smoke PASS — §9 chaos contract: kill-mid-run · corrupt-input · no-network (+ SSE gate via G7)\n");
process.exit(0);
