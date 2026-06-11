/**
 * misc — the remaining PLAN §4 command surface so `turbo --help` is complete (B10).
 *
 *  - `turbo stream-doctor <file>` — REAL: runs the SSE-trap detectors (P-10/P-11) over one file.
 *  - `turbo contract <dir>`       — stub → owned by Cluster C/E (contract-test wiring).
 *  - `turbo migrate-plan <dir>`   — stub → owned by a later cluster (Strangler-Fig planner).
 *  - `turbo eval [--level]`       — stub → wiring lands in E19 (the eval pyramid).
 *
 * Stubs are honest: they print where the real implementation lands and exit non-zero so no caller
 * mistakes a stub for a finished feature (the no-fake-green discipline).
 */
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { DETECTORS } from "../../audit/detectors/index.js";
import type { Finding, ScanFile } from "../../audit/types.js";
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
  if (json) {
    emitJson({ ok: false, stub: true, command, implementedIn: owner });
    return;
  }
  warn(`turbo ${command}: not yet implemented — lands in ${owner}.`);
  process.exitCode = 2;
}

export function runContract(opts: { json: boolean }): void {
  stub("contract", "Cluster C/E (contract-test wiring)", opts.json);
}

export function runMigratePlan(opts: { json: boolean }): void {
  stub("migrate-plan", "a later cluster (Strangler-Fig migration planner)", opts.json);
}

export function runEval(opts: { json: boolean }): void {
  stub("eval", "E19 (the eval pyramid)", opts.json);
}
