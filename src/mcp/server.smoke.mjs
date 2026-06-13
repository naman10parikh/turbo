#!/usr/bin/env node
/**
 * turbo MCP round-trip smoke (C13 verify + Wave-T Contract-layer, cold-runnable).
 *
 * The pyramid's "Contract (MCP JSON-RPC schema)" row (PLAN §9) asks the server's `tools/list`/`tools/call`
 * to conform to the MCP schema and for `scaffold_service`/`gen_from_openapi`/`audit_service` to round-trip
 * with valid arg/return shapes. The original smoke covered tools/list + ONLY scaffold_service; Wave-T
 * extends it to the full §9 contract. Spawns the stdio server via the SDK Client + StdioClientTransport
 * (the SDK validates the JSON-RPC envelope on both ends), then asserts:
 *   1. `tools/list` returns all 8 documented tool names, each with a JSON-Schema-object `inputSchema`.
 *   2. `scaffold_service {name, out}` round-trips → `{ok:true, out, files}` (valid return shape).
 *   3. `gen_from_openapi {spec, out}` (THE acceptance-path tool) round-trips → `{ok:true, operations, files}`.
 *   4. `audit_service {dir}` round-trips on the generated tree → a findings ARRAY (valid return shape).
 *   5. NEGATIVE contract: an unknown tool AND a missing-required-arg each return `isError:true` with a
 *      conformant `content[0].text` — never a transport crash (the agent sees the failure as data).
 *
 * Exit 0 on pass, non-zero on any failure. No network, no secrets.
 *   Run: node src/mcp/server.smoke.mjs   (after `pnpm build`)
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const EXPECTED = [
  "scaffold_service",
  "gen_from_openapi",
  "audit_service",
  "check_versions",
  "contract_test",
  "stream_doctor",
  "explain_pitfall",
  "search_brain",
];

const here = dirname(fileURLToPath(import.meta.url)); // src/mcp
const serverEntry = join(here, "..", "..", "dist", "mcp", "server.js");
const fixture = join(here, "..", "..", "eval", "fixtures", "petstore.openapi.json");

function fail(msg) {
  process.stderr.write(`✗ MCP smoke: ${msg}\n`);
  process.exit(1);
}

const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
const client = new Client({ name: "turbo-mcp-smoke", version: "0.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);

  /** Round-trip helper: callTool, assert no isError, parse the JSON content body, return it. */
  async function callOk(name, args, label) {
    const res = await client.callTool({ name, arguments: args });
    if (res.isError) fail(`${label}: returned isError: ${JSON.stringify(res.content).slice(0, 200)}`);
    if (!Array.isArray(res.content) || res.content[0]?.type !== "text") fail(`${label}: result content is not the MCP {type:"text"} shape: ${JSON.stringify(res.content).slice(0, 160)}`);
    const text = res.content[0].text ?? "";
    try {
      return JSON.parse(text);
    } catch {
      fail(`${label}: result body not JSON (the --json contract): ${text.slice(0, 200)}`);
    }
  }

  // 1) tools/list → all 8 names, each with a JSON-Schema-object inputSchema (the MCP wire-format contract).
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  const missing = EXPECTED.filter((n) => !names.includes(n));
  if (missing.length > 0) fail(`tools/list missing: ${missing.join(", ")} (got: ${names.join(", ")})`);
  if (names.length !== EXPECTED.length) fail(`expected exactly ${EXPECTED.length} tools, got ${names.length}: ${names.join(", ")}`);
  for (const t of tools) {
    if (!t.inputSchema || typeof t.inputSchema !== "object" || t.inputSchema.type !== "object" || typeof t.inputSchema.properties !== "object") {
      fail(`tools/list: ${t.name} inputSchema is not a JSON-Schema object {type:"object", properties:{…}}: ${JSON.stringify(t.inputSchema).slice(0, 160)}`);
    }
  }
  process.stdout.write(`✓ tools/list returned all 8 with JSON-Schema inputSchemas: ${names.join(", ")}\n`);

  // 2) scaffold_service → round-trip → {ok:true, out, files}.
  const sOut = mkdtempSync(join(tmpdir(), "turbo-mcp-scaffold-"));
  const sBody = await callOk("scaffold_service", { name: "demo", out: sOut }, "scaffold_service");
  if (sBody.ok !== true || !sBody.out) fail(`scaffold_service result not a scaffold: ${JSON.stringify(sBody).slice(0, 200)}`);
  process.stdout.write(`✓ tools/call scaffold_service round-tripped → ${sBody.out} (${sBody.files?.length ?? 0} files)\n`);

  // 3) gen_from_openapi (THE acceptance-path tool) → round-trip → {ok:true, operations, files}.
  const gOut = mkdtempSync(join(tmpdir(), "turbo-mcp-gen-"));
  const gBody = await callOk("gen_from_openapi", { spec: fixture, out: gOut }, "gen_from_openapi");
  if (gBody.ok !== true || typeof gBody.operations !== "number" || !Array.isArray(gBody.files)) {
    fail(`gen_from_openapi return shape invalid (want {ok:true, operations:<n>, files:[…]}): ${JSON.stringify(gBody).slice(0, 200)}`);
  }
  if (gBody.operations < 1 || gBody.files.length < 1) fail(`gen_from_openapi produced an empty service: ${JSON.stringify(gBody).slice(0, 160)}`);
  process.stdout.write(`✓ tools/call gen_from_openapi round-tripped → ${gBody.operations} ops, ${gBody.files.length} files\n`);

  // 4) audit_service on the just-generated tree → round-trip → a findings ARRAY (valid return shape).
  const aBody = await callOk("audit_service", { dir: gBody.out ?? gOut }, "audit_service");
  const findings = Array.isArray(aBody.findings) ? aBody.findings : Array.isArray(aBody) ? aBody : null;
  if (findings === null) fail(`audit_service did not return a findings array: ${JSON.stringify(aBody).slice(0, 200)}`);
  process.stdout.write(`✓ tools/call audit_service round-tripped → findings array (len ${findings.length})\n`);

  // 5) NEGATIVE contract — failures surface as isError data, not transport crashes.
  // (a) unknown tool → isError:true with conformant content.
  const unk = await client.callTool({ name: "no_such_tool", arguments: {} });
  if (unk.isError !== true || unk.content?.[0]?.type !== "text") fail(`unknown-tool call must return isError:true with text content; got ${JSON.stringify(unk).slice(0, 160)}`);
  // (b) gen_from_openapi missing its required `spec` → isError:true (the buildArgv guard, surfaced as data).
  const noSpec = await client.callTool({ name: "gen_from_openapi", arguments: {} });
  if (noSpec.isError !== true || unk.content?.[0]?.type !== "text") fail(`gen_from_openapi without required \`spec\` must return isError:true; got ${JSON.stringify(noSpec).slice(0, 160)}`);
  process.stdout.write(`✓ negative contract: unknown-tool + missing-required-arg both return isError:true (failures are data, not crashes)\n`);

  await client.close();
  process.stdout.write("✓ MCP smoke PASS (8 tools+schemas listed · scaffold/gen/audit round-trip · negative contract)\n");
  process.exit(0);
} catch (e) {
  fail(e instanceof Error ? (e.stack ?? e.message) : String(e));
}
