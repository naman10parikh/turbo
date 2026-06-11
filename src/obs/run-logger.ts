/**
 * run-logger — append-only telemetry for every `turbo` CLI run (Observability component, layer (a)).
 *
 * One JSON line per run to `logs/runs.jsonl`: { command, model, duration_ms, cost, outcome, ts }.
 * Built here because the CLI spine (B6) needs it to log `turbo api` runs; the full Observability
 * component (E21, Cluster E) extends this with the per-generated-service Pino/`/health` layer.
 *
 * Append-only: never rewrites; a crashed run still leaves a partial-but-valid prior history.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface RunRecord {
  readonly command: string;
  readonly model: string;
  readonly duration_ms: number;
  readonly cost: number;
  readonly outcome: "ok" | "error";
  readonly ts: string;
  readonly detail?: string;
}

/** Resolve the canonical log path relative to the turbo repo root (CWD of the CLI). */
export function runsLogPath(cwd: string = process.cwd()): string {
  return join(cwd, "logs", "runs.jsonl");
}

/**
 * Append one run record. Best-effort: a logging failure must never crash the CLI command itself,
 * so the write is wrapped and a warning is emitted (the law: no silent swallow).
 */
export function logRun(record: RunRecord, cwd: string = process.cwd()): void {
  const path = runsLogPath(cwd);
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(record) + "\n", "utf8");
  } catch (e) {
    console.warn(
      "[run-logger] could not append run record:",
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Wrap a command body with timing + outcome logging. The deterministic CLI is tokenless, so
 * `cost` is 0 and `model` is the routing tag the budget system assigns (default: deterministic).
 */
export async function withRunLog<T>(
  command: string,
  body: () => Promise<T>,
  cwd: string = process.cwd(),
): Promise<T> {
  const start = Date.now();
  const model = process.env.ANTHROPIC_MODEL ?? "deterministic";
  try {
    const result = await body();
    logRun(
      {
        command,
        model,
        duration_ms: Date.now() - start,
        cost: 0,
        outcome: "ok",
        ts: new Date().toISOString(),
      },
      cwd,
    );
    return result;
  } catch (e) {
    logRun(
      {
        command,
        model,
        duration_ms: Date.now() - start,
        cost: 0,
        outcome: "error",
        ts: new Date().toISOString(),
        detail: e instanceof Error ? e.message : String(e),
      },
      cwd,
    );
    throw e;
  }
}
