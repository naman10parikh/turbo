/**
 * eval/harness — shared fixtures + exec helpers for the eval pyramid (E19).
 *
 * The pyramid grades turbo's expertise against the 13 golden tasks (G1–G13 → S-IDs, PLAN §6).
 * Most tasks share ONE expensive setup: generate the petstore service once, optionally `npm install`
 * it, and audit it once. This module owns that shared context so each task is a cheap pure check.
 *
 * Two task kinds:
 *   - tree tasks (L1/L2/L3 structural + behavioral) read the generated service / its audit;
 *   - knowledge tasks (L1/L2/L3 expertise) call `turbo brain`/`turbo explain` and assert the
 *     scenario is present + ranked (the no-self-grading gate: a deterministic CLI check, not an opinion).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { err, ok, type Result } from "../core/result.js";

/** Resolve the built `turbo` CLI next to this module (dist/eval/ → dist/cli/index.js). */
export function cliEntry(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "cli", "index.js");
}

/** The acceptance fixture spec (E20), resolved from the repo root (CWD = the turbo repo in CI/dev). */
export function petstoreSpec(cwd: string = process.cwd()): string {
  return join(cwd, "eval", "fixtures", "petstore.openapi.json");
}

/** Run a command synchronously; never throws — returns a Result keyed on exit code. */
export function run(cmd: string, args: string[], cwd?: string): Result<string, string> {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: process.env, maxBuffer: 1024 * 1024 * 32 });
  if (r.error) return err(`${cmd} failed to spawn: ${r.error.message}`);
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (typeof r.status === "number" && r.status !== 0) {
    return err(`${cmd} ${args.join(" ")} exited ${r.status}: ${out.trim().slice(0, 400)}`);
  }
  return ok(out);
}

/** Run `turbo <argv>` via the built CLI; returns combined stdout+stderr as a Result. */
export function turbo(args: string[], cwd?: string): Result<string, string> {
  return run(process.execPath, [cliEntry(), ...args], cwd);
}

/** Run `turbo <argv> --json` and parse the JSON object it printed (first `{`-line onward). */
export function turboJson(args: string[], cwd?: string): Result<Record<string, unknown>, string> {
  const r = turbo([...args, "--json"], cwd);
  if (!r.ok) {
    // A non-zero exit can still carry parseable JSON on stdout (e.g. audit with critical findings).
    const parsed = tryParseObject(r.error);
    return parsed ? ok(parsed) : err(r.error);
  }
  const parsed = tryParseObject(r.value);
  return parsed ? ok(parsed) : err(`no JSON object in output of: turbo ${args.join(" ")}`);
}

function tryParseObject(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  try {
    return JSON.parse(text.slice(start)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** The shared per-run context every task receives (built once by buildContext). */
export interface EvalContext {
  /** The repo root (CWD) — where brain/ and eval/fixtures/ live. */
  readonly cwd: string;
  /** Path to the freshly-generated petstore service tree. */
  readonly serviceDir: string;
  /** Whether `npm install` ran in the service tree (L2/L3 tasks that need tsc/contract require it). */
  readonly installed: boolean;
  /** `tsc --noEmit` over the generated tree (only meaningful when installed); undefined = not run. */
  readonly typecheck?: Result<string, string>;
  /** `npm run contract` over the generated tree (only meaningful when installed); undefined = not run. */
  readonly contract?: Result<string, string>;
  /** The `turbo audit --json` report over the generated tree (findings array). */
  readonly auditFindings: ReadonlyArray<Record<string, unknown>>;
  /** The generated service's package.json (parsed). */
  readonly servicePkg: Record<string, unknown>;
  /** Read a file from the generated service tree (relative path); "" if absent. */
  readFile(rel: string): string;
}

export interface BuildContextOptions {
  readonly cwd?: string;
  /** Run `npm install` in the generated tree (needed for the L2/L3 tsc + contract tasks). */
  readonly install?: boolean;
}

/**
 * Build the shared context: generate the petstore service once, audit it, optionally install.
 * Returns a typed error (never throws) if generation fails — the runner surfaces it as a hard fail.
 */
export function buildContext(opts: BuildContextOptions = {}): Result<EvalContext, string> {
  const cwd = opts.cwd ?? process.cwd();
  const spec = petstoreSpec(cwd);
  if (!existsSync(spec)) return err(`acceptance fixture missing: ${spec} (E20)`);

  const serviceDir = join(mkdtempSync(join(tmpdir(), "turbo-eval-")), "service");
  const gen = turbo(["api", "--spec", spec, "--out", serviceDir], cwd);
  if (!gen.ok) return err(`turbo api (generate petstore) failed: ${gen.error}`);

  let installed = false;
  let typecheck: Result<string, string> | undefined;
  let contract: Result<string, string> | undefined;
  if (opts.install) {
    const inst = run("npm", ["install", "--no-audit", "--no-fund", "--silent"], serviceDir);
    if (!inst.ok) return err(`npm install in generated tree failed: ${inst.error}`);
    installed = true;
    // Run the two expensive tree-level gates ONCE here so L2/L3 tasks read a flag, not re-run them.
    const tscBin = join(serviceDir, "node_modules", ".bin", "tsc");
    typecheck = existsSync(tscBin)
      ? run(tscBin, ["--noEmit"], serviceDir)
      : run("npx", ["--no-install", "tsc", "--noEmit"], serviceDir);
    contract = run("npm", ["run", "contract"], serviceDir);
  }

  const audit = turboJson(["audit", serviceDir], cwd);
  const auditFindings = audit.ok && Array.isArray(audit.value.findings)
    ? (audit.value.findings as Record<string, unknown>[])
    : [];

  let servicePkg: Record<string, unknown> = {};
  try {
    servicePkg = JSON.parse(readFileSync(join(serviceDir, "package.json"), "utf8")) as Record<string, unknown>;
  } catch {
    return err(`generated service has no readable package.json at ${serviceDir}`);
  }

  const readFile = (rel: string): string => {
    try {
      return readFileSync(join(serviceDir, rel), "utf8");
    } catch {
      return "";
    }
  };

  return ok({ cwd, serviceDir, installed, typecheck, contract, auditFindings, servicePkg, readFile });
}
