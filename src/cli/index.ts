#!/usr/bin/env node
/**
 * turbo CLI entry (B6) — the employee's hands.
 *
 * Every operation a coding agent needs has a deterministic, `--json`, non-interactive path (O-13):
 *   api · scaffold · audit · check · brain · explain · contract · stream-doctor · migrate-plan · eval
 *
 * commander wires the tree; `--version` reads package.json; `--help` lists every PLAN §4 command.
 * Exit code is 0 on success and non-zero on error (set by the io helpers / command bodies) — the
 * agent-operability contract. No interactive prompts anywhere (headless by design).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { runApi } from "./commands/api.js";
import { runScaffold } from "./commands/scaffold.js";
import { runAudit } from "./commands/audit.js";
import { runCheck } from "./commands/check.js";
import { runBrain } from "./commands/brain.js";
import { runExplain } from "./commands/explain.js";
import { runContract, runEval, runMigratePlan, runStreamDoctor } from "./commands/misc.js";

/** Read turbo's own version from the packaged package.json (one dir up from dist/cli/). */
function readVersion(): string {
  // Walk up from the compiled module to find the package.json (works from dist/ and from src/ via tsx).
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string; version?: string };
      if (pkg.name === "turbo" && typeof pkg.version === "string") return pkg.version;
    } catch {
      // keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "0.0.0";
}

const program = new Command();

program
  .name("turbo")
  .description(
    "turbo — the Energy fleet's backend/runtime domain-expert employee. Scaffolds & audits TS-strict Hono services from OpenAPI.",
  )
  .version(readVersion(), "-v, --version", "print the turbo version");

// --- api: THE acceptance path (OpenAPI → typed Hono service) ----------------------------------
program
  .command("api")
  .description("OpenAPI spec → typed Hono service (Zod boundaries, no-default PATCH schema, /openapi.json, /health, Pino)")
  .requiredOption("--spec <openapi>", "path to the OpenAPI spec (JSON/YAML)")
  .option("--out <dir>", "output directory for the generated service", "./turbo-service")
  .option("--runtime <runtime>", "target runtime: node | workers", "node")
  .option("--json", "emit machine-readable JSON", false)
  .action(async (o: { spec: string; out: string; runtime: string; json: boolean }) => {
    const runtime = o.runtime === "workers" ? "workers" : "node";
    await runApi({ spec: o.spec, out: o.out, runtime, json: o.json });
  });

// --- scaffold: a blank law-compliant Hono baseline (w3cj, deps bumped) --------------------------
program
  .command("scaffold")
  .description("stand up a blank law-compliant Hono service (w3cj baseline, deps bumped to current pins)")
  .option("--name <n>", "service name", "turbo-service")
  .option("--out <dir>", "output directory", "./turbo-service")
  .option("--json", "emit machine-readable JSON", false)
  .action(async (o: { name: string; out: string; json: boolean }) => {
    await runScaffold({ name: o.name, out: o.out, json: o.json });
  });

// --- audit: the pitfall scanner over a service tree ---------------------------------------------
program
  .command("audit")
  .description("run the KNOWN-PITFALLS detectors over a service (P-02/P-04/P-09/SSE/RPC/CORS), findings keyed by P-ID")
  .argument("<dir>", "the service directory to audit")
  .option("--json", "emit machine-readable JSON", false)
  .action((dir: string, o: { json: boolean }) => {
    runAudit({ dir, json: o.json });
  });

// --- check: the version-drift oracle (powers RSI) -----------------------------------------------
program
  .command("check")
  .description("version-drift oracle: flag stale pins, the Hono security floor, and EOL runtimes (offline-safe)")
  .option("--json", "emit machine-readable JSON", false)
  .action(async (o: { json: boolean }) => {
    await runCheck({ json: o.json });
  });

// --- brain: BM25 search over brain/ (the Memory layer) ------------------------------------------
program
  .command("brain")
  .description("BM25 ranked search over the brain/ expertise corpus (pitfalls, scenarios, opinions)")
  .argument("<query...>", "the search query")
  .option("--json", "emit machine-readable JSON", false)
  .option("--limit <n>", "max hits", "5")
  .action((query: string[], o: { json: boolean; limit: string }) => {
    runBrain({ query: query.join(" "), json: o.json, limit: Number.parseInt(o.limit, 10) || 5 });
  });

// --- explain: print one pitfall/scenario/opinion by id ------------------------------------------
program
  .command("explain")
  .description("print a pitfall/scenario/opinion by id (P-/S-/O-) with its detection + fix")
  .argument("<id>", "the P-/S-/O- id, e.g. P-04")
  .option("--json", "emit machine-readable JSON", false)
  .action((id: string, o: { json: boolean }) => {
    runExplain({ id, json: o.json });
  });

// --- stream-doctor: audit one streaming route for the SSE traps ---------------------------------
program
  .command("stream-doctor")
  .description("audit a streaming route file for the SSE traps (missing 3rd-arg handler / X-Accel-Buffering)")
  .argument("<file>", "the source file containing the streaming route")
  .option("--json", "emit machine-readable JSON", false)
  .action((file: string, o: { json: boolean }) => {
    runStreamDoctor({ file, json: o.json });
  });

// --- contract / migrate-plan / eval: honest stubs (real bodies land in C/E) ---------------------
program
  .command("contract")
  .description("contract-test a service vs its /openapi.json + RPC type (wiring lands in Cluster C/E)")
  .argument("[dir]", "the service directory")
  .option("--json", "emit machine-readable JSON", false)
  .action((_dir: string | undefined, o: { json: boolean }) => {
    runContract({ json: o.json });
  });

program
  .command("migrate-plan")
  .description("emit a Strangler-Fig migration plan (wrap-then-strangle; planner lands in a later cluster)")
  .argument("[dir]", "the service directory")
  .option("--to <target>", "migration target: fastify | hono")
  .option("--json", "emit machine-readable JSON", false)
  .action((_dir: string | undefined, o: { json: boolean }) => {
    runMigratePlan({ json: o.json });
  });

program
  .command("eval")
  .description("run the eval pyramid L1/L2/L3 (wiring lands in E19)")
  .option("--level <n>", "eval level: 1 | 2 | 3")
  .option("--json", "emit machine-readable JSON", false)
  .action((o: { json: boolean }) => {
    runEval({ json: o.json });
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  process.stderr.write(`✗ turbo: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
