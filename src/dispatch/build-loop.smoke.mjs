#!/usr/bin/env node
/**
 * build-loop verify (D16, cold-runnable). Asserts:
 *   1. ORDERING + HAPPY PATH — a real run on the petstore spec executes the four phases in exactly
 *      scaffold → validate → contract → audit and completes all green (the log shows scaffold before
 *      validate before contract before audit). This is a real `npm install` + `tsc --noEmit` + contract.
 *   2. TYPED HALT — a deliberately broken step halts the chain with a typed Result error (NOT a crash),
 *      and no later phase runs.
 *
 * Pass `--fast` to skip the real-install ordering run (CI smoke / offline) and assert ordering only via
 * the static PHASE_ORDER contract + the typed-halt. Default = the real proof.
 *
 * Exit 0 on pass, non-zero on any failure.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // src/dispatch
const { runBuildLoop, PHASE_ORDER } = await import(join(here, "..", "..", "dist", "dispatch", "build-loop.js"));

const FAST = process.argv.includes("--fast");

function fail(msg) {
  process.stderr.write(`✗ build-loop verify: ${msg}\n`);
  process.exit(1);
}

const EXPECTED = ["scaffold", "validate", "contract", "audit"];

// --- 1) ORDERING + HAPPY PATH (real run unless --fast) ---
if (!FAST) {
  const out = mkdtempSync(join(tmpdir(), "turbo-loop-full-"));
  const spec = join(here, "..", "..", "eval", "fixtures", "petstore.openapi.json");
  const seen = [];
  process.stdout.write(`… running the real loop (npm install + tsc + contract + audit) into ${out}\n`);
  const res = runBuildLoop({ out, spec, onPhaseStart: (p) => seen.push(p) });
  if (JSON.stringify(seen) !== JSON.stringify(EXPECTED)) {
    fail(`phases out of order: got [${seen.join(" → ")}], expected [${EXPECTED.join(" → ")}]`);
  }
  if (!res.completed) {
    const f = res.phases.find((p) => !p.ok);
    fail(`loop halted at '${res.failedAt}': ${f?.detail ?? res.error}`);
  }
  // The log must show each phase strictly before the next.
  const logged = res.phases.map((p) => p.phase);
  for (let i = 0; i < logged.length - 1; i++) {
    if (PHASE_ORDER.indexOf(logged[i]) >= PHASE_ORDER.indexOf(logged[i + 1])) {
      fail(`log order violated: ${logged.join(" → ")}`);
    }
  }
  process.stdout.write(`✓ ORDERING + HAPPY PATH: ${logged.join(" → ")} (all green)\n`);
} else {
  if (JSON.stringify([...PHASE_ORDER]) !== JSON.stringify(EXPECTED)) fail(`PHASE_ORDER contract wrong: ${PHASE_ORDER}`);
  process.stdout.write(`✓ ORDERING (static): PHASE_ORDER = ${PHASE_ORDER.join(" → ")}\n`);
}

// --- 2) TYPED HALT: break the SECOND phase → only scaffold+validate announce, halt is a typed error ---
{
  const seen = [];
  const out = mkdtempSync(join(tmpdir(), "turbo-loop-halt-"));
  const res = runBuildLoop({
    out,
    skipInstall: true,
    failPhase: "validate",
    onPhaseStart: (p) => seen.push(p),
  });
  if (res.completed !== false) fail(`expected completed=false on a broken phase, got ${res.completed}`);
  if (res.failedAt !== "validate") fail(`expected failedAt=validate, got ${res.failedAt}`);
  if (typeof res.error !== "string" || res.error.length === 0) fail(`expected a typed string error, got ${res.error}`);
  if (seen.includes("contract") || seen.includes("audit")) fail(`a later phase ran after the halt: ${seen.join(", ")}`);
  process.stdout.write(`✓ TYPED HALT: halted at '${res.failedAt}' with a typed error; later phases did NOT run (announced: ${seen.join(" → ")})\n`);
}

process.stdout.write("✓ build-loop verify PASS\n");
process.exit(0);
