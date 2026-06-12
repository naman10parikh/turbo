#!/usr/bin/env node
/**
 * turbo MCP server (C13) — the stdio CLI-wrapper.
 *
 * Default transport = **stdio** (Q4: matches the dev-tool consumption pattern + the inherited `.mcp.json`
 * shape; P-13: a stdio wrapper has no Hono `Context` to fumble — tool needs are passed explicitly as
 * argv). A hosted **`@hono/mcp` Streamable-HTTP** variant is the documented dual-mode (AGENTS.md / llms.txt)
 * and would reuse `TURBO_TOOLS` verbatim.
 *
 * Each `tools/call` shells out to the `turbo` CLI (`dist/cli/index.js`) with `--json`, captures stdout,
 * and returns it as MCP content. The CLI is the single source of truth — the MCP layer adds zero logic,
 * so the 8 tools can never drift from the CLI behavior the acceptance test already gates.
 *
 * Built with the SDK's low-level `Server` + raw JSON-Schema input shapes (no `zod` dependency — the CLI
 * is zero-dep Result, O-03; pulling zod just for the MCP layer would break Simplicity-First).
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { findTool, TURBO_TOOLS } from "./tools.js";

/** Resolve the built `turbo` CLI entry next to this compiled module (dist/mcp/ → dist/cli/index.js). */
function cliEntry(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // .../dist/mcp
  return join(here, "..", "cli", "index.js");
}

/** Result of one CLI invocation. */
interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

/**
 * Run the `turbo` CLI with the given argv (+ `--json`), capture stdout/stderr, resolve a CliResult.
 * Never throws on a non-zero exit — the caller turns the exit code into an MCP tool result so an agent
 * sees the failure as data, not a transport error.
 */
function runCli(argv: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliEntry(), ...argv, "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("error", (e) => resolve({ stdout, stderr: stderr + String(e), code: 1 }));
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
  });
}

/** Parse the CLI's `--json` stdout if possible; else return the raw text (the CLI always JSON on data cmds). */
function parseJsonOrText(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

async function main(): Promise<void> {
  const server = new Server(
    { name: "turbo", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  // tools/list — the 8 documented tools (PLAN §4 MCP list).
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TURBO_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // tools/call — dispatch to the CLI; return the parsed JSON as the tool result.
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const tool = findTool(name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `unknown tool: ${name}` }],
      };
    }

    let argv: string[];
    try {
      argv = tool.buildArgv(rawArgs ?? {}, {});
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
      };
    }

    const result = await runCli(argv);
    const payload = parseJsonOrText(result.stdout);
    // A non-zero exit, or a CLI `{ ok:false }` / `{ stub:true }` body, surfaces as a tool error so the
    // calling agent can branch — but the structured body is always returned for inspection.
    const cliReportedFailure =
      result.code !== 0 ||
      (payload !== null &&
        typeof payload === "object" &&
        (("ok" in payload && (payload as { ok: unknown }).ok === false) ||
          ("stub" in payload && (payload as { stub: unknown }).stub === true)));

    const text =
      payload === undefined
        ? result.stderr.trim() || `turbo ${tool.cliCommand} produced no output (exit ${result.code})`
        : typeof payload === "string"
          ? payload
          : JSON.stringify(payload, null, 2);

    return {
      ...(cliReportedFailure ? { isError: true } : {}),
      content: [{ type: "text" as const, text }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stay alive on the transport until stdin closes (the MCP host owns the lifecycle).
  process.stderr.write("turbo MCP server (stdio) ready — 8 tools wrapping the turbo CLI\n");
}

main().catch((e: unknown) => {
  process.stderr.write(`✗ turbo-mcp: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
