#!/usr/bin/env node
/**
 * turbo MCP round-trip smoke (C13 verify, cold-runnable).
 *
 * Spawns the stdio MCP server via the SDK Client + StdioClientTransport, then asserts:
 *   1. `tools/list` returns all 8 documented tool names.
 *   2. `tools/call scaffold_service {name:"demo", out:<tmp>}` round-trips (rc=0, scaffold result returned).
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

function fail(msg) {
  process.stderr.write(`✗ MCP smoke: ${msg}\n`);
  process.exit(1);
}

const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
const client = new Client({ name: "turbo-mcp-smoke", version: "0.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);

  // 1) tools/list → all 8 names.
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  const missing = EXPECTED.filter((n) => !names.includes(n));
  if (missing.length > 0) fail(`tools/list missing: ${missing.join(", ")} (got: ${names.join(", ")})`);
  if (names.length !== EXPECTED.length) fail(`expected exactly ${EXPECTED.length} tools, got ${names.length}: ${names.join(", ")}`);
  process.stdout.write(`✓ tools/list returned all 8: ${names.join(", ")}\n`);

  // 2) tools/call scaffold_service → round-trip.
  const out = mkdtempSync(join(tmpdir(), "turbo-mcp-"));
  const res = await client.callTool({ name: "scaffold_service", arguments: { name: "demo", out } });
  if (res.isError) fail(`scaffold_service returned isError: ${JSON.stringify(res.content)}`);
  const text = (res.content?.[0]?.text) ?? "";
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    fail(`scaffold_service result not JSON: ${text.slice(0, 200)}`);
  }
  if (body.ok !== true || !body.out) fail(`scaffold_service result not a scaffold: ${text.slice(0, 200)}`);
  process.stdout.write(`✓ tools/call scaffold_service round-tripped → ${body.out} (${body.files?.length ?? 0} files)\n`);

  await client.close();
  process.stdout.write("✓ MCP smoke PASS (8 tools listed + scaffold_service round-trip)\n");
  process.exit(0);
} catch (e) {
  fail(e instanceof Error ? (e.stack ?? e.message) : String(e));
}
