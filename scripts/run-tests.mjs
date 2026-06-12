#!/usr/bin/env node
/**
 * run-tests — turbo's test entry (`pnpm test`). Runs the repo's real test surface (E19/CI fix).
 *
 * The repo's tests are cold-runnable `*.smoke.mjs` files (run directly via node, not vitest) plus the
 * E19 eval pyramid. Before this, `package.json` `test` was `vitest run` with ZERO `.test.ts` files →
 * `pnpm test` exited 1 ("No test files found"), reddening the inherited `ci.yml` build-test job on every
 * commit. This runner discovers and runs the smoke tests + the L1 eval level (fast, deterministic) so
 * `pnpm build && pnpm test` is green and the test surface is real (the Evals component, red-blocking).
 *
 * Heavy/online steps are kept CI-cheap: build-loop runs `--fast` (skips the real npm-install ordering
 * run); the eval pyramid runs `--level 1` (no install). The full pyramid + the live boot run in
 * acceptance.yml (E23) where the extra minutes are warranted.
 *
 * Run:  pnpm test          (after `pnpm build` — the smoke tests import dist/)
 * Exit: 0 iff every suite passes; non-zero on the first failure.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** Recursively find every `*.smoke.mjs` under a directory. */
function findSmoke(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...findSmoke(full));
    else if (name.endsWith(".smoke.mjs")) out.push(full);
  }
  return out;
}

/** Run one suite (a node invocation); return true on exit 0. */
function runSuite(label, args) {
  process.stdout.write(`\n▶ ${label}\n`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit", env: process.env });
  const passed = r.status === 0;
  process.stdout.write(passed ? `✓ ${label}\n` : `✗ ${label} (exit ${r.status})\n`);
  return passed;
}

// Build must have run first (the smoke tests import dist/). Fail clearly if not.
if (!existsSync(join(ROOT, "dist", "cli", "index.js"))) {
  process.stderr.write("✗ run-tests: dist/ not built — run `pnpm build` first.\n");
  process.exit(1);
}

const suites = [];
// 1) Smoke tests (cold-runnable). build-loop gets --fast for CI speed (static ordering + typed-halt).
for (const file of findSmoke(join(ROOT, "src"))) {
  const args = file.endsWith("build-loop.smoke.mjs") ? [file, "--fast"] : [file];
  suites.push([`smoke: ${file.replace(ROOT + "/", "")}`, args]);
}
// 2) The L1 eval level (fast, deterministic — no install). The full pyramid runs in acceptance.yml (E23).
suites.push(["eval L1 (the structural-assertion level)", [join(ROOT, "dist", "cli", "index.js"), "eval", "--level", "1", "--json"]]);

let failures = 0;
for (const [label, args] of suites) {
  if (!runSuite(label, args)) failures++;
}

process.stdout.write(`\n${"─".repeat(56)}\n`);
if (failures === 0) {
  process.stdout.write(`✓ pnpm test: ${suites.length}/${suites.length} suites green\n`);
  process.exit(0);
} else {
  process.stdout.write(`✗ pnpm test: ${failures}/${suites.length} suite(s) FAILED\n`);
  process.exit(1);
}
