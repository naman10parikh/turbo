/**
 * eval/runner — runs the eval pyramid (E19). Invoked by `turbo eval [--level 1|2|3] [--json]`.
 *
 * Orchestration:
 *   1. Build the shared context ONCE (generate the petstore service; install for L2/L3; audit).
 *   2. Run each task filtered by --level; CI-blocking tasks (G1/G3/G4/G5/G7/G13) run **pass^k (k≥3)**
 *      — every trial must pass (the checks are deterministic, so k trials record the stability the
 *      checklist demands; a single trial is not evidence).
 *   3. Emit a binary summary (pass/fail per task + the pyramid verdict). No self-grading — each task's
 *      gate is an objective check (dsip.json noSelfGrading:true).
 *
 * Exit code: 0 iff every selected task passes; non-zero otherwise (agent-operable gate).
 */
import { buildContext, type EvalContext } from "./harness.js";
import { CI_BLOCKING, TASKS, type EvalTask } from "./tasks.js";
import type { Result } from "../core/result.js";

/** Trials per CI-blocking task (pass^k, k≥3 — PLAN §6 / the checklist). */
export const PASS_K = 3;

export interface TaskResult {
  readonly g: string;
  readonly id: string;
  readonly level: 1 | 2 | 3;
  readonly ciBlocking: boolean;
  readonly trials: number;
  readonly passed: boolean;
  readonly evidence: string;
}

export interface EvalSummary {
  readonly ok: boolean;
  readonly level: "all" | 1 | 2 | 3;
  readonly installed: boolean;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly ciBlockingTotal: number;
  readonly ciBlockingPassed: number;
  readonly tasks: readonly TaskResult[];
}

export interface RunEvalOptions {
  /** Restrict to one Hamel level; omit → run all 13. */
  readonly level?: 1 | 2 | 3;
  /** Override the repo root (defaults to CWD). */
  readonly cwd?: string;
  /**
   * Install the generated tree (enables the tree-level tsc + contract gates for G8/G9/G13).
   * Default true — the acceptance spine (G13) needs it. Tests may pass false for a fast static pass.
   */
  readonly install?: boolean;
}

/** Run one task with pass^k semantics when it is CI-blocking (every trial must pass). */
function runTask(task: EvalTask, ctx: EvalContext): TaskResult {
  const trials = task.ciBlocking ? PASS_K : 1;
  let lastEvidence = "";
  let allPassed = true;
  for (let i = 0; i < trials; i++) {
    const r: Result<string, string> = task.run(ctx);
    lastEvidence = r.ok ? r.value : r.error;
    if (!r.ok) {
      allPassed = false;
      break; // a single failed trial fails the pass^k gate
    }
  }
  return {
    g: task.g,
    id: task.id,
    level: task.level,
    ciBlocking: task.ciBlocking,
    trials,
    passed: allPassed,
    evidence: lastEvidence,
  };
}

/** Run the pyramid and return a structured summary (does not print — the CLI layer formats it). */
export function runEvalPyramid(opts: RunEvalOptions = {}): { summary: EvalSummary; error?: string } {
  const cwd = opts.cwd ?? process.cwd();
  const wantLevel = opts.level;
  // Install by default unless the caller is running only L1 (no tree gates needed there).
  const install = opts.install ?? wantLevel !== 1;

  const ctxResult = buildContext({ cwd, install });
  if (!ctxResult.ok) {
    return {
      error: ctxResult.error,
      summary: {
        ok: false, level: wantLevel ?? "all", installed: install,
        total: 0, passed: 0, failed: 0, ciBlockingTotal: 0, ciBlockingPassed: 0, tasks: [],
      },
    };
  }
  const ctx = ctxResult.value;

  const selected = wantLevel ? TASKS.filter((t) => t.level === wantLevel) : TASKS;
  const results = selected.map((t) => runTask(t, ctx));

  const passed = results.filter((r) => r.passed).length;
  const ciBlocking = results.filter((r) => CI_BLOCKING.has(r.g));
  const ciBlockingPassed = ciBlocking.filter((r) => r.passed).length;

  const summary: EvalSummary = {
    ok: passed === results.length,
    level: wantLevel ?? "all",
    installed: ctx.installed,
    total: results.length,
    passed,
    failed: results.length - passed,
    ciBlockingTotal: ciBlocking.length,
    ciBlockingPassed,
    tasks: results,
  };
  return { summary };
}
