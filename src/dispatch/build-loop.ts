/**
 * build-loop (D16) — turbo's internal routing loop for the multi-step build.
 *
 * Orders the deterministic chain: **scaffold → validate (`tsc --noEmit`) → contract-test → audit**.
 * This is how `turbo api`'s sub-steps and the RSI loop (D17) chain *deterministically* — no agentgrid,
 * no `tmux select-pane`, just a typed in-process state machine. Each phase returns a `Result`; the first
 * failure **halts the chain with a typed error** (never a crash), and the phase log proves the ordering.
 *
 * Phases shell out to the already-acceptance-gated `turbo` CLI (the single source of truth — the loop
 * adds zero generation logic), and to `npm`/`tsc` in the generated tree. Pure orchestration.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { err, ok, type Result } from "../core/result.js";

/** The four ordered phases (the order is the contract — D16 asserts it). */
export type Phase = "scaffold" | "validate" | "contract" | "audit";
export const PHASE_ORDER: readonly Phase[] = ["scaffold", "validate", "contract", "audit"];

/** One phase outcome in the run log. */
export interface PhaseLogEntry {
  readonly phase: Phase;
  readonly ok: boolean;
  readonly detail: string;
  readonly ts: string;
}

/** The loop result: the ordered phase log + a typed error if it halted early. */
export interface BuildLoopResult {
  readonly completed: boolean;
  readonly phases: readonly PhaseLogEntry[];
  /** The phase that halted the chain, if any (a typed halt, not a crash). */
  readonly failedAt?: Phase;
  readonly error?: string;
}

export interface BuildLoopOptions {
  /** The directory the service is generated into + validated/contract-tested/audited in. */
  readonly out: string;
  /** OpenAPI spec → use `turbo api` for scaffold. Omit → use `turbo scaffold` (blank baseline). */
  readonly spec?: string;
  /** Skip `npm install` before validate/contract (tests can pre-install or run install-free phases). */
  readonly skipInstall?: boolean;
  /**
   * Force a specific phase to fail (test hook for "a deliberately broken step halts the chain").
   * Deterministic, no real breakage needed.
   */
  readonly failPhase?: Phase;
  /** Sink for phase-start lines (defaults to stderr) — lets a caller/test capture the ordering proof. */
  readonly onPhaseStart?: (phase: Phase) => void;
}

/** Resolve the built `turbo` CLI next to this module (dist/dispatch/ → dist/cli/index.js). */
function cliEntry(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "cli", "index.js");
}

/** Run a command synchronously, return a Result keyed on exit code (never throws). */
function run(cmd: string, args: string[], cwd?: string): Result<string, string> {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: process.env });
  if (r.error) return err(`${cmd} failed to spawn: ${r.error.message}`);
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  if (typeof r.status === "number" && r.status !== 0) {
    return err(`${cmd} ${args.join(" ")} exited ${r.status}: ${out.slice(0, 400)}`);
  }
  return ok(out);
}

/** Run `turbo <argv>` via the built CLI. */
function turbo(args: string[], cwd?: string): Result<string, string> {
  return run(process.execPath, [cliEntry(), ...args], cwd);
}

function entry(phase: Phase, res: Result<string, string>): PhaseLogEntry {
  return {
    phase,
    ok: res.ok,
    detail: res.ok ? res.value.split("\n").slice(-1)[0]?.slice(0, 160) ?? "ok" : res.error.slice(0, 240),
    ts: new Date().toISOString(),
  };
}

/**
 * Run the full chain in order. Returns the ordered phase log; halts (typed) at the first failure.
 * The phase-start callback fires BEFORE each phase runs → the ordering is observable even on a halt.
 */
export function runBuildLoop(opts: BuildLoopOptions): BuildLoopResult {
  const phases: PhaseLogEntry[] = [];
  const announce = opts.onPhaseStart ?? ((p: Phase) => process.stderr.write(`[build-loop] phase: ${p}\n`));

  for (const phase of PHASE_ORDER) {
    announce(phase);

    // Test hook: force this phase to fail deterministically (no real breakage needed).
    if (opts.failPhase === phase) {
      const res = err(`[test] forced failure at phase '${phase}'`);
      phases.push(entry(phase, res));
      return { completed: false, phases, failedAt: phase, error: res.error };
    }

    let res: Result<string, string>;
    switch (phase) {
      case "scaffold":
        res = opts.spec
          ? turbo(["api", "--spec", opts.spec, "--out", opts.out, "--json"])
          : turbo(["scaffold", "--out", opts.out, "--json"]);
        if (res.ok && !opts.skipInstall) {
          // `npm install` makes validate/contract meaningful (the generated tree is npm + Node 24).
          const installed = run("npm", ["install", "--no-audit", "--no-fund"], opts.out);
          if (!installed.ok) res = err(`scaffold ok but npm install failed: ${installed.error}`);
        }
        break;
      case "validate":
        // The law: `tsc --noEmit` over the generated tree (no `any`, types check). Uses the tree's own tsc.
        res = existsSync(join(opts.out, "node_modules", ".bin", "tsc"))
          ? run(join(opts.out, "node_modules", ".bin", "tsc"), ["--noEmit"], opts.out)
          : run("npx", ["--no-install", "tsc", "--noEmit"], opts.out);
        break;
      case "contract":
        // The generated service ships a runnable `contract` script (B6/B7) — OpenAPI conformance + RPC type.
        res = run("npm", ["run", "contract"], opts.out);
        break;
      case "audit":
        // Zero critical pitfalls (P-02/P-04). `turbo audit` sets a non-zero exit on a critical finding.
        res = turbo(["audit", opts.out, "--json"]);
        break;
    }

    phases.push(entry(phase, res));
    if (!res.ok) {
      // Typed halt — the chain stops here, the caller gets a Result error, NOT a thrown crash.
      return { completed: false, phases, failedAt: phase, error: res.error };
    }
  }

  return { completed: true, phases };
}
