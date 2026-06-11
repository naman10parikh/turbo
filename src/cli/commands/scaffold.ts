/**
 * `turbo scaffold [--name <n>] [--out <dir>]`
 *
 * Stand up a blank law-compliant Hono service from the `w3cj/hono-open-api-starter` baseline SHAPE,
 * deps bumped to current pins (Hono ≥4.12.25, Zod 4.4, `@hono/zod-openapi` 1.x) — S-10. Rather than
 * cloning the stale 0.x/Zod-3 starter over the network (the bump-and-migrate is where breakage hides,
 * PLAN Risk #2), turbo emits the same route-group layout already pinned to the bumped versions, with
 * `/health`, `/openapi.json` + Scalar, an `hcWithType` export, and the runnable `contract` script.
 */
import { resolve } from "node:path";
import { isErr } from "../../core/result.js";
import { emitService } from "../../generator/emit-service.js";
import type { ServiceIR } from "../../generator/ir.js";
import { writeTree } from "../../generator/write-tree.js";
import { logRun } from "../../obs/run-logger.js";
import { emitJson, fail, info, ok as printOk } from "../io.js";

export interface ScaffoldOptions {
  name: string;
  out: string;
  json: boolean;
}

/** The blank baseline: one example "tasks" resource demonstrating GET-list + POST-with-default + PATCH. */
function baselineIR(name: string): ServiceIR {
  const taskObject = {
    kind: "object" as const,
    refName: "Task",
    properties: [
      { name: "id", schema: { kind: "string" as const }, required: true, hasDefault: false },
      { name: "title", schema: { kind: "string" as const, minLength: 1 }, required: true, hasDefault: false },
      {
        name: "status",
        schema: { kind: "enum" as const, enumValues: ["open", "done"] },
        required: true,
        hasDefault: false,
      },
    ],
  };
  const createTask = {
    kind: "object" as const,
    refName: "CreateTask",
    properties: [
      { name: "title", schema: { kind: "string" as const, minLength: 1 }, required: true, hasDefault: false },
      {
        name: "status",
        schema: { kind: "enum" as const, enumValues: ["open", "done"] },
        required: false,
        hasDefault: true,
        defaultValue: "open",
      },
    ],
  };
  const updateTask = {
    kind: "object" as const,
    refName: "UpdateTask",
    properties: [
      { name: "title", schema: { kind: "string" as const, minLength: 1 }, required: false, hasDefault: false },
      {
        name: "status",
        schema: { kind: "enum" as const, enumValues: ["open", "done"] },
        required: false,
        hasDefault: false,
      },
    ],
  };
  return {
    title: name,
    version: "1.0.0",
    namedSchemas: [
      { name: "Task", schema: taskObject },
      { name: "CreateTask", schema: createTask },
      { name: "UpdateTask", schema: updateTask },
    ],
    operations: [
      {
        operationId: "listTasks",
        method: "get",
        honoPath: "/tasks",
        rawPath: "/tasks",
        summary: "List tasks",
        pathParams: [],
        isPartialUpdate: false,
        responseSchema: { kind: "array", items: taskObject },
        responseStatus: 200,
      },
      {
        operationId: "createTask",
        method: "post",
        honoPath: "/tasks",
        rawPath: "/tasks",
        summary: "Create a task",
        pathParams: [],
        requestSchema: createTask,
        isPartialUpdate: false,
        responseSchema: taskObject,
        responseStatus: 201,
      },
      {
        operationId: "updateTask",
        method: "patch",
        honoPath: "/tasks/:taskId",
        rawPath: "/tasks/{taskId}",
        summary: "Update a task (partial)",
        pathParams: [{ name: "taskId" }],
        requestSchema: updateTask,
        isPartialUpdate: true,
        responseSchema: taskObject,
        responseStatus: 200,
      },
    ],
  };
}

export async function runScaffold(opts: ScaffoldOptions): Promise<void> {
  const start = Date.now();
  const outDir = resolve(opts.out);
  const name = opts.name.replace(/[^a-zA-Z0-9-]/g, "-") || "turbo-service";

  const files = emitService(baselineIR(name), name);
  const written = writeTree(outDir, files);
  if (isErr(written)) {
    logRun({
      command: "scaffold",
      model: "deterministic",
      duration_ms: Date.now() - start,
      cost: 0,
      outcome: "error",
      ts: new Date().toISOString(),
      detail: written.error,
    });
    if (opts.json) emitJson({ ok: false, error: written.error });
    fail(`turbo scaffold: ${written.error}`);
    return;
  }

  const duration = Date.now() - start;
  logRun({
    command: "scaffold",
    model: "deterministic",
    duration_ms: duration,
    cost: 0,
    outcome: "ok",
    ts: new Date().toISOString(),
    detail: written.value,
  });

  const summary = {
    ok: true,
    out: written.value,
    name,
    baseline: "w3cj/hono-open-api-starter (deps bumped: hono@^4.12.25, zod@^4.4, @hono/zod-openapi@^1.4)",
    files: [...files.keys()],
    duration_ms: duration,
  };
  if (opts.json) {
    emitJson(summary);
  } else {
    printOk(`Scaffolded ${name} (law-compliant Hono baseline, deps bumped)`);
    info(`  → ${written.value}`);
    info(`  next: cd ${written.value} && npm install && npx tsc --noEmit && npm run contract`);
  }
}
