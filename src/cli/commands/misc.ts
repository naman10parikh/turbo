/**
 * misc — the remaining PLAN §4 command surface so `turbo --help` is complete (B10).
 *
 *  - `turbo stream-doctor <file>` — REAL: runs the SSE-trap detectors (P-10/P-11) over one file.
 *  - `turbo eval [--level]`       — REAL (E19): runs the Hamel L1/L2/L3 golden-task pyramid.
 *  - `turbo contract <dir>`       — stub → owned by Cluster C/E (contract-test wiring).
 *  - `turbo migrate-plan <dir>`   — stub → owned by a later cluster (Strangler-Fig planner).
 *
 * Stubs are honest: they print where the real implementation lands and exit non-zero so no caller
 * mistakes a stub for a finished feature (the no-fake-green discipline).
 */
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { DETECTORS } from "../../audit/detectors/index.js";
import type { Finding, ScanFile } from "../../audit/types.js";
import { runEvalPyramid } from "../../eval/runner.js";
import { emitJson, fail, info, ok as printOk, warn } from "../io.js";
import { logRun } from "../../obs/run-logger.js";

/** `turbo stream-doctor <file>` — audit one streaming route for the SSE traps (S-08, P-10/P-11/P-12). */
export function runStreamDoctor(opts: { file: string; json: boolean }): void {
  const start = Date.now();
  const path = resolve(opts.file);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if (opts.json) emitJson({ ok: false, error: `cannot read ${path}` });
    fail(`turbo stream-doctor: cannot read ${path}: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  const file: ScanFile = { path: relative(process.cwd(), path), text };
  const sseDetectors = DETECTORS.filter((d) => d.id === "P-10/P-11");
  const traps: Finding[] = [];
  for (const d of sseDetectors) traps.push(...d.detect([file], undefined));

  logRun({
    command: "stream-doctor",
    model: "deterministic",
    duration_ms: Date.now() - start,
    cost: 0,
    outcome: "ok",
    ts: new Date().toISOString(),
    detail: `${path}: ${traps.length} traps`,
  });

  if (opts.json) {
    emitJson({ ok: true, file: file.path, traps });
    return;
  }
  if (traps.length === 0) {
    printOk(`turbo stream-doctor: no SSE traps in ${file.path}`);
    return;
  }
  for (const t of traps) {
    info(`[${t.severity.toUpperCase()}] ${t.pitfall}  ${t.file}:${t.line}`);
    info(`  ${t.message}`);
  }
}

/** A shared honest-stub emitter for the commands whose real bodies land in other clusters. */
function stub(command: string, owner: string, json: boolean): void {
  logRun({
    command,
    model: "deterministic",
    duration_ms: 0,
    cost: 0,
    outcome: "ok",
    ts: new Date().toISOString(),
    detail: `stub → ${owner}`,
  });
  // Non-fake-green in BOTH paths: an agent calling `turbo <stub> --json` (the agent-native O-13
  // surface) must get a non-zero exit just like the human-readable path — otherwise a caller doing
  // `turbo contract --json && proceed` proceeds on an unimplemented feature. Set the code BEFORE the
  // json early-return so the `--json` branch can't slip out at exit 0.
  process.exitCode = 2;
  if (json) {
    emitJson({ ok: false, stub: true, command, implementedIn: owner });
    return;
  }
  warn(`turbo ${command}: not yet implemented — lands in ${owner}.`);
}

export function runContract(opts: { json: boolean }): void {
  stub("contract", "Cluster C/E (contract-test wiring)", opts.json);
}

export function runMigratePlan(opts: { json: boolean }): void {
  stub("migrate-plan", "a later cluster (Strangler-Fig migration planner)", opts.json);
}

/** `turbo eval [--level 1|2|3] [--json]` — run the Hamel L1/L2/L3 golden-task pyramid (E19). */
export function runEval(opts: { json: boolean; level?: 1 | 2 | 3 }): void {
  const start = Date.now();
  const { summary, error } = runEvalPyramid({ level: opts.level });

  logRun({
    command: "eval",
    model: "deterministic",
    duration_ms: Date.now() - start,
    cost: 0,
    outcome: summary.ok ? "ok" : "error",
    ts: new Date().toISOString(),
    detail: error
      ? `setup failed: ${error.slice(0, 160)}`
      : `level=${summary.level} ${summary.passed}/${summary.total} pass (CI-blocking ${summary.ciBlockingPassed}/${summary.ciBlockingTotal})`,
  });

  if (opts.json) {
    emitJson({ ...summary, ...(error ? { error } : {}) });
    if (!summary.ok) process.exitCode = 1;
    return;
  }

  if (error) {
    fail(`turbo eval: setup failed — ${error}`);
    return;
  }

  info(`turbo eval — pyramid (level ${summary.level}), generated service ${summary.installed ? "installed + " : ""}audited`);
  for (const t of summary.tasks) {
    const mark = t.passed ? "✓" : "✗";
    const blocking = t.ciBlocking ? ` [CI-block, ${t.trials}×]` : "";
    info(`  ${mark} ${t.g} (${t.id}) L${t.level}${blocking}: ${t.evidence.slice(0, 140)}`);
  }
  if (summary.ok) {
    printOk(`turbo eval: ${summary.passed}/${summary.total} green (CI-blocking ${summary.ciBlockingPassed}/${summary.ciBlockingTotal}, pass^${3})`);
  } else {
    fail(`turbo eval: ${summary.failed}/${summary.total} FAILED (CI-blocking ${summary.ciBlockingPassed}/${summary.ciBlockingTotal})`);
  }
}
