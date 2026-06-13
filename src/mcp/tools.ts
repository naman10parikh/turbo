/**
 * turbo MCP — the 8 tool definitions (C13).
 *
 * Design (Q4 default + P-13): turbo's MCP server is a **stdio CLI-wrapper**. Each tool maps 1:1 to a
 * `turbo` CLI command (PLAN §4 "MCP server tool list" table). The tool needs are passed **explicitly**
 * as named arguments that build the CLI argv — we never reach for a Hono `Context` (P-13: accessing `c`
 * inside a tool def is awkward/fragile; the stdio wrapper sidesteps it entirely by having no Context).
 *
 * This module is pure data + a pure `argv` builder so it is trivially unit-testable and so the hosted
 * `@hono/mcp` Streamable-HTTP variant (documented dual-mode) can reuse the exact same tool list.
 *
 * inputSchema is raw JSON Schema (draft-07 object shape) — the MCP wire format — so the server needs no
 * `zod` dependency (the CLI itself is zero-dep Result, O-03; adding zod just for the MCP layer would
 * violate Simplicity-First).
 */

/** A JSON-Schema object shape (the subset MCP tools use). */
export interface JsonSchemaObject {
  readonly type: "object";
  readonly properties: Readonly<Record<string, JsonSchemaProp>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

interface JsonSchemaProp {
  readonly type: "string" | "boolean" | "number" | "object";
  readonly description?: string;
  readonly enum?: readonly string[];
}

/** A turbo MCP tool: its wire metadata + how to turn its args into a `turbo` CLI argv. */
export interface TurboTool {
  /** MCP tool name (the §4 table's left column). */
  readonly name: string;
  /** One-line description shown in `tools/list`. */
  readonly description: string;
  /** JSON-Schema for the tool's arguments (MCP `inputSchema`). */
  readonly inputSchema: JsonSchemaObject;
  /** The `turbo` subcommand this tool wraps (the §4 "Maps to" column). */
  readonly cliCommand: string;
  /**
   * Build the `turbo` argv from validated args. Pure; no I/O. The server appends `--json` itself.
   * `tmp` is a per-call scratch dir the server provides for tools that may receive an inline spec.
   */
  readonly buildArgv: (args: Record<string, unknown>, tmp: { specFile?: string }) => string[];
}

/** Coerce an unknown arg to a non-empty string, or undefined. */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * The 8 tools, exactly matching PLAN §4's "MCP server tool list" — each maps to a CLI command.
 * Order matches the §4 table.
 */
export const TURBO_TOOLS: readonly TurboTool[] = [
  {
    name: "scaffold_service",
    description:
      "Stand up a blank law-compliant Hono service (w3cj baseline, deps bumped: hono@^4.12.25, zod@^4.4, @hono/zod-openapi@^1.4). Maps to `turbo scaffold`.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "service name (default turbo-service)" },
        runtime: { type: "string", enum: ["node"], description: "target runtime (node only; workers planned)" },
        out: { type: "string", description: "output directory (default ./turbo-service)" },
      },
      additionalProperties: false,
    },
    cliCommand: "scaffold",
    buildArgv: (args) => {
      const argv = ["scaffold"];
      const name = str(args.name);
      const out = str(args.out);
      if (name) argv.push("--name", name);
      if (out) argv.push("--out", out);
      // `runtime` is accepted for parity with gen_from_openapi; scaffold currently emits node baseline.
      return argv;
    },
  },
  {
    name: "gen_from_openapi",
    description:
      "Generate a typed Hono service from an OpenAPI spec (THE acceptance path: Zod boundaries, no-default PATCH schema, /openapi.json, /health, Pino, hcWithType, runnable contract script). Maps to `turbo api`.",
    inputSchema: {
      type: "object",
      properties: {
        spec: {
          type: "string",
          description: "path to an OpenAPI spec file (JSON/YAML). Inline spec objects are not supported over stdio — pass a path.",
        },
        runtime: { type: "string", enum: ["node"], description: "target runtime (node only; workers planned — `turbo api --runtime workers` rejects until implemented)" },
        out: { type: "string", description: "output directory (default ./turbo-service)" },
      },
      required: ["spec"],
      additionalProperties: false,
    },
    cliCommand: "api",
    buildArgv: (args) => {
      const spec = str(args.spec);
      if (!spec) throw new Error("gen_from_openapi requires a `spec` path");
      const argv = ["api", "--spec", spec];
      const out = str(args.out);
      const runtime = str(args.runtime);
      if (out) argv.push("--out", out);
      if (runtime === "workers" || runtime === "node") argv.push("--runtime", runtime);
      return argv;
    },
  },
  {
    name: "audit_service",
    description:
      "Run the KNOWN-PITFALLS detectors over a service tree (P-02 module-scope Map, P-04 defaulted PATCH schema, SSE traps, RPC-type loss, CORS+credentials). Returns findings keyed by P-ID. Maps to `turbo audit`.",
    inputSchema: {
      type: "object",
      properties: { dir: { type: "string", description: "the service directory to audit" } },
      required: ["dir"],
      additionalProperties: false,
    },
    cliCommand: "audit",
    buildArgv: (args) => {
      const dir = str(args.dir);
      if (!dir) throw new Error("audit_service requires a `dir`");
      return ["audit", dir];
    },
  },
  {
    name: "check_versions",
    description:
      "Version-drift oracle: npm view every brain/TOOL-MATRIX.md pin, flag stale pins, the Hono security floor (<4.12.16 = vulnerable), and EOL runtimes (Node 20). Offline-safe. Maps to `turbo check`.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    cliCommand: "check",
    buildArgv: () => ["check"],
  },
  {
    name: "contract_test",
    description:
      "Contract-test a service vs its /openapi.json + the RPC `typeof app` compile check (oasdiff gate vs a prior spec). Maps to `turbo contract`.",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string", description: "the service directory" },
        oldSpec: { type: "string", description: "a prior spec path for the diff gate (optional)" },
      },
      additionalProperties: false,
    },
    cliCommand: "contract",
    buildArgv: (args) => {
      const argv = ["contract"];
      const dir = str(args.dir);
      if (dir) argv.push(dir);
      return argv;
    },
  },
  {
    name: "stream_doctor",
    description:
      "Audit one streaming route file for the SSE traps: missing 3rd-arg error handler, missing X-Accel-Buffering:no, body re-read (P-10/P-11/P-12, S-08). Maps to `turbo stream-doctor`.",
    inputSchema: {
      type: "object",
      properties: { file: { type: "string", description: "the source file containing the streaming route" } },
      required: ["file"],
      additionalProperties: false,
    },
    cliCommand: "stream-doctor",
    buildArgv: (args) => {
      const file = str(args.file);
      if (!file) throw new Error("stream_doctor requires a `file`");
      return ["stream-doctor", file];
    },
  },
  {
    name: "explain_pitfall",
    description:
      "Print a pitfall/scenario/opinion by id (P-/S-/O-) with its detection + fix + source. Maps to `turbo explain`.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "the P-/S-/O- id, e.g. P-04" } },
      required: ["id"],
      additionalProperties: false,
    },
    cliCommand: "explain",
    buildArgv: (args) => {
      const id = str(args.id);
      if (!id) throw new Error("explain_pitfall requires an `id`");
      return ["explain", id];
    },
  },
  {
    name: "search_brain",
    description:
      "BM25 ranked search over the brain/ expertise corpus (pitfalls, scenarios, opinions) — returns ranked hits. Maps to `turbo brain`.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "the search query" },
        limit: { type: "number", description: "max hits (default 5)" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    cliCommand: "brain",
    buildArgv: (args) => {
      const query = str(args.query);
      if (!query) throw new Error("search_brain requires a `query`");
      const argv = ["brain", query];
      const limit = typeof args.limit === "number" ? args.limit : undefined;
      if (limit && Number.isFinite(limit)) argv.push("--limit", String(Math.trunc(limit)));
      return argv;
    },
  },
];

/** Look up a tool by its MCP name. */
export function findTool(name: string): TurboTool | undefined {
  return TURBO_TOOLS.find((t) => t.name === name);
}
