/**
 * `turbo api --spec <openapi> [--out <dir>] [--runtime node|workers] [--json]`
 *
 * THE acceptance path (PLAN §5). OpenAPI spec → a typed Hono service:
 *   - Zod schemas at every boundary (dedicated no-default PATCH schema — P-04)
 *   - routes chained into one AppType (hcWithType infers — P-03)
 *   - /openapi.json + Scalar, /health, Pino JSON logs (O-13)
 *   - a runnable `contract` script so the acceptance CI's `npm run contract` never misses
 */
import { basename, resolve } from "node:path";
import { isErr } from "../../core/result.js";
import { emitService } from "../../generator/emit-service.js";
import { parseOpenApi } from "../../generator/parse-openapi.js";
import { writeTree } from "../../generator/write-tree.js";
import { logRun } from "../../obs/run-logger.js";
import { emitJson, fail, info, ok as printOk } from "../io.js";

export interface ApiOptions {
  spec: string;
  out: string;
  runtime: "node" | "workers";
  json: boolean;
  /** Overwrite a non-empty, non-turbo-generated --out dir (off by default — containment). */
  force?: boolean;
}

export async function runApi(opts: ApiOptions): Promise<void> {
  const start = Date.now();
  const specPath = resolve(opts.spec);
  const outDir = resolve(opts.out);
  const serviceName = basename(outDir).replace(/[^a-zA-Z0-9-]/g, "-") || "turbo-service";

  // The generator currently emits a Node entry only (main.ts uses @hono/node-server's serve(); a
  // Workers target needs `export default app` + wrangler). Rather than emit a Node service and
  // mislabel it `runtime:"workers"` (the T-council fake-green), reject the unimplemented target with
  // a typed error so a caller never deploys a Node tree to Workers thinking turbo built one.
  if (opts.runtime === "workers") {
    const msg =
      "turbo api: --runtime workers is not yet implemented (the generator emits a Node entry only). Use --runtime node; a Workers target (export default app + wrangler.toml) is planned.";
    logRun({
      command: "api",
      model: "deterministic",
      duration_ms: Date.now() - start,
      cost: 0,
      outcome: "error",
      ts: new Date().toISOString(),
      detail: "rejected --runtime workers (unimplemented)",
    });
    if (opts.json) emitJson({ ok: false, error: msg, runtime: "workers", implemented: false });
    fail(msg);
    return;
  }

  const parsed = await parseOpenApi(specPath);
  if (isErr(parsed)) {
    logRun({
      command: "api",
      model: "deterministic",
      duration_ms: Date.now() - start,
      cost: 0,
      outcome: "error",
      ts: new Date().toISOString(),
      detail: parsed.error,
    });
    if (opts.json) emitJson({ ok: false, error: parsed.error });
    fail(`turbo api: ${parsed.error}`);
    return;
  }

  const files = emitService(parsed.value, serviceName);
  const written = writeTree(outDir, files, { force: opts.force });
  if (isErr(written)) {
    logRun({
      command: "api",
      model: "deterministic",
      duration_ms: Date.now() - start,
      cost: 0,
      outcome: "error",
      ts: new Date().toISOString(),
      detail: written.error,
    });
    if (opts.json) emitJson({ ok: false, error: written.error });
    fail(`turbo api: ${written.error}`);
    return;
  }

  const duration = Date.now() - start;
  logRun({
    command: "api",
    model: "deterministic",
    duration_ms: duration,
    cost: 0,
    outcome: "ok",
    ts: new Date().toISOString(),
    detail: `${parsed.value.operations.length} routes → ${written.value}`,
  });

  const summary = {
    ok: true,
    out: written.value,
    runtime: opts.runtime,
    service: serviceName,
    operations: parsed.value.operations.length,
    schemas: parsed.value.namedSchemas.length,
    files: [...files.keys()],
    duration_ms: duration,
  };

  if (opts.json) {
    emitJson(summary);
  } else {
    printOk(`Generated ${serviceName}: ${summary.operations} routes, ${summary.schemas} schemas`);
    info(`  → ${written.value}`);
    info(`  contract: cd ${written.value} && npm install && npm run contract`);
  }
}
