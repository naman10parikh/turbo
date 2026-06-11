/**
 * `turbo check [--json]` — the version-drift oracle (B9). Flags stale pins, the Hono security floor
 * (<4.12.16 = vulnerable), and EOL runtimes (the Node-20 class). Powers the RSI loop (D17).
 *
 * Offline-safe: degrades to the local last-known-current table and exits fast (no hang) when npm is
 * unreachable — the chaos invariant.
 */
import { runVersionCheck } from "../../audit/version-oracle.js";
import { brainFile } from "../paths.js";
import { emitJson, fail, info, ok as printOk } from "../io.js";
import { logRun } from "../../obs/run-logger.js";

export interface CheckOptions {
  json: boolean;
  /** Allow tests/the offline path to override the per-package npm timeout. */
  timeoutMs?: number;
  /** Allow pointing at an alternate matrix copy (B9's "planted stale pin in a copy" test). */
  matrix?: string;
}

export async function runCheck(opts: CheckOptions): Promise<void> {
  const start = Date.now();
  const matrixPath = opts.matrix ?? brainFile("TOOL-MATRIX.md");
  const result = await runVersionCheck(matrixPath, {
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
  });

  const stale = result.findings.filter((f) => f.status === "stale" || f.status === "vulnerable");

  logRun({
    command: "check",
    model: "deterministic",
    duration_ms: Date.now() - start,
    cost: 0,
    outcome: "ok",
    ts: new Date().toISOString(),
    detail: `online=${result.online} stale=${stale.length} eol=${result.eolRuntimes.length}`,
  });

  if (opts.json) {
    emitJson({
      ok: true,
      online: result.online,
      stale: stale.map((f) => ({ pkg: f.pkg, pinned: f.pinned, current: f.current, status: f.status })),
      eol: result.eolRuntimes,
      findings: result.findings,
    });
    return;
  }

  info(result.online ? "turbo check (npm live):" : "turbo check (offline — local table):");
  for (const f of result.findings) {
    const tag =
      f.status === "vulnerable" ? "VULNERABLE" : f.status === "stale" ? "STALE" : f.status === "ok" ? "ok" : "?";
    info(`  [${tag}] ${f.pkg}  pinned=${f.pinned ?? "-"}  current=${f.current ?? "-"} (${f.source})`);
    if (f.note) info(`         ${f.note}`);
  }
  for (const eol of result.eolRuntimes) info(`  [EOL] ${eol}`);

  if (stale.length > 0) {
    fail(`turbo check: ${stale.length} pin(s) need attention`);
  } else {
    printOk("all pins current; no EOL/vulnerable runtimes");
  }
}
