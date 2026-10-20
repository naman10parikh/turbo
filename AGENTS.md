# AGENTS.md — turbo

> **turbo** is the Energy fleet's **backend / runtime** domain-expert employee. It is a *tool-employee*,
> not a messaging product: coding agents (Claude Code, the energy hub, sibling employees) operate it through
> the **CLI** and the **MCP server**; the chairman watches it through the **local cockpit**. This file tells
> an agent what turbo does, how to invoke every tool, the hard boundary, and what NOT to do.
>
> One-line stack: **Hono ≥4.12.25 · Node 24 LTS (floor 22) · Zod 4.4 · `@hono/zod-openapi` 1.x · Result<T,E> ·
> SSE · Bun for CLIs/tests · ship Vercel-Node, promote latency-critical to Workers.** Powered by Energy.

## Install in one step

```bash
npx -y -p github:naman10parikh/turbo turbo --help          # the CLI
npx -y -p github:naman10parikh/turbo turbo-mcp             # the MCP server (stdio)
claude mcp add --transport stdio turbo -- npx -y -p github:naman10parikh/turbo turbo-mcp
```

In Claude Code, `/plugin install turbo --marketplace naman10parikh/turbo` brings the 5 skills, the two personas,
the two law gates (the `tsc --noEmit` commit gate and the `new Map()`/PATCH write gate) and the MCP server.

## What turbo does

turbo owns TS-strict backend services: runtime+version selection, HTTP service structure (Hono),
Zod-boundary validation, API-contract design (REST/RPC/OpenAPI/versioning), typed errors (Result<T,E>),
output streaming (SSE/WS), contract-testing its own routes, surviving the serverless/edge state boundary,
being agent-operable, and safe (Strangler-Fig) framework migration.

**THE acceptance test:** `turbo api --spec <openapi>` → a typed Hono service with Zod boundaries at every
route, a dedicated no-default PATCH schema, `/openapi.json` + Scalar, `/health`, Pino JSON logs, an
`hcWithType` client, and green contract tests.

## The CLI command tree (Bash-invokable, `--json` on data commands)

| Command | What it does |
|---|---|
| `turbo api --spec <openapi> [--out <dir>] [--runtime node\|workers] [--json]` | **The acceptance test.** OpenAPI → typed Hono service (Zod boundaries, typed routes chained to one `AppType`, `/openapi.json`+Scalar, `/health`, Pino, `hcWithType`), contract tests green. |
| `turbo scaffold [--name <n>] [--out <dir>]` | Stand up a blank law-compliant Hono service from the `w3cj/hono-open-api-starter` baseline, deps bumped to current pins. |
| `turbo audit <dir> [--json]` | Run the 16-pitfall audit (`brain/KNOWN-PITFALLS.md`) over a service — `new Map()`/Fluid race (P-02), PATCH `.default()` (P-04), missing `tsc --noEmit` (P-09), SSE traps (P-10/P-11), RPC-type loss (P-03), CORS+credentials (S-11). Findings keyed by P-ID. |
| `turbo check [--json]` | Version-drift oracle: `npm view <pkg> version` vs `brain/TOOL-MATRIX.md` pins; flags EOL runtimes (Node 20) + the Hono security floor (<4.12.16 = vulnerable). Offline-safe. |
| `turbo contract <dir> [--diff <old-spec>]` | Contract-test the service: responses parse vs `/openapi.json`; `oasdiff` gate vs a prior spec; RPC `typeof app` compile check. |
| `turbo stream-doctor <file>` | Audit a streaming route for the SSE traps: missing 3rd-arg error handler, missing `X-Accel-Buffering:no`, no `while(!stream.aborted)`. |
| `turbo migrate-plan <dir> --to <fastify\|hono>` | Emit a Strangler-Fig migration plan (wrap-then-strangle, dependency-audit first, rollback per step). Never big-bang. |
| `turbo brain <query>` | BM25 ranked search over `brain/` (the Memory layer) — pitfalls/scenarios/opinions. |
| `turbo explain <P-id\|S-id\|O-id>` | Print the pitfall/scenario/opinion by ID with detection + fix. |
| `turbo eval [--level 1\|2\|3]` | Run the eval pyramid (G1–G13). |

`turbo --version` and `turbo --help` work. Exit 0 on success, non-zero on error.

## The MCP server (turbo's OWN — 8 tools)

turbo ships its own MCP server (bin `turbo-mcp`; the root `.mcp.json` starts it straight from GitHub as `turbo`,
and `.mcp.dev.json` starts the local build). **Default transport = stdio**
(a CLI-wrapper — each tool shells out to the `turbo` CLI with `--json`, so the tools can never drift from
the gated CLI behavior). A hosted **`@hono/mcp` Streamable-HTTP** variant is planned, not built yet (it would serve the same
`TURBO_TOOLS` list over HTTP). Start it via `node dist/mcp/server.js` (or `turbo-mcp`). An MCP
`tools/list` JSON-RPC call returns these 8 names:

| Tool | Maps to | Arg sketch |
|---|---|---|
| `scaffold_service` | `turbo scaffold` | `{ name?, runtime?: "node"\|"workers", out? }` |
| `gen_from_openapi` | `turbo api` | `{ spec, runtime?, out? }` |
| `audit_service` | `turbo audit` | `{ dir }` → `{ findings: [{pitfall, file, line, severity}] }` |
| `check_versions` | `turbo check` | `{}` → `{ stale, eol }` |
| `contract_test` | `turbo contract` | `{ dir, oldSpec? }` |
| `stream_doctor` | `turbo stream-doctor` | `{ file }` |
| `explain_pitfall` | `turbo explain` | `{ id }` → `{ detection, fix, source }` |
| `search_brain` | `turbo brain` | `{ query }` → ranked hits |

No live keys in `.mcp.json` or `.mcp.dev.json` — env refs only, asserted by `node scripts/check-mcp-env-refs.mjs`
(the stdio wrapper inherits the process env for `turbo check`).

## Sub-agents (flat, two distinct scopes)

- **`runtime-safety-auditor`** (`.claude/agents/runtime-safety-auditor.md`) — the higher-value persona; catches
  the 🔴 data-bleed / crash-under-load class: module-scope `new Map()`/Fluid race (S-01/P-02), SSE traps
  (S-08/P-10-12), the Zod-`.default()`-on-PATCH trap (S-02/P-04), stale/vulnerable pins (S-11). **Packaged as
  a reusable, cross-harness-callable sub-agent** (callable via `Agent` from the energy hub on any service tree).
- **`contract-reviewer`** (`.claude/agents/contract-reviewer.md`) — OpenAPI/RPC-type drift (S-09), versioning
  theater + the missing diff-gate (S-06), JSON round-trip type lies like Date→string (S-12).

Both declare an explicit `model: opus` (no bare-default model routing).

## Skills (5 — `skills/*/SKILL.md`, each calls a real `turbo` verb)

- `scaffold-hono-service` (S-10 + O-02/O-08/O-09) → `turbo scaffold` / `api` / `audit`
- `audit-serverless-state` (S-01 + O-01 + P-02) → `turbo audit`
- `zod-boundary-and-patch` (S-02 + O-04 + P-04/P-05) → `turbo audit` / `explain P-04`
- `sse-streaming-safely` (S-08 + O-12 + P-10/P-11/P-12) → `turbo stream-doctor`
- `design-api-contract` (O-07/O-08/O-10/O-11) → `turbo api` / `contract` / `brain`

## The hard boundary (what turbo REFUSES)

- **Rate-limiting / caching / KV / edge-state stores → echo's territory** (Wave 2). turbo owns only the
  *header semantics* a service emits (`cache-control`, `ETag`, `Vary`) — echo holds the *store*. turbo never
  holds a state-store secret, and `rhinobase/hono-rate-limiter` is flagged **do NOT wire.**
- **Holding mutable cross-request state in process** — forbidden by the energy law (cold-empty + Fluid-racy).
- **Other verticals:** frontend shell → pixel · mobile → pebble · DB schema/migrations/RLS → acorn ·
  auth provider wiring → badge · product billing → penny · deploy/CI release engineering → rocket. turbo
  *runs on* the deploy host and *exposes* routes those employees consume; it does not own their verticals.

## What NOT to do (the NOT-list)

- **No Node 20.** Upstream EOL 2026-04-30 (P-01). Floor = Node 22, default = Node 24; pin `engines.node:"24.x"`.
- **No `new Map()` / module-scope mutable state** in `app/api/**` (P-02 — the data-bleed class).
- **No big-bang migration** — Strangler-Fig only (O-14).
- **No reusing a defaulted create-schema for PATCH** (P-04 — silent data loss).
- **Never trust "it runs" as "it type-checks"** — native strip-types doesn't type-check; the `tsc --noEmit`
  CI gate is non-negotiable (P-09/O-09).

## Browser / computer-use = N/A

turbo is a **server** employee, not a web-operator. It scaffolds and audits services; it does not drive a
browser. The "if it touches the web, wire a browser tool" clause of the harness checklist does not bind turbo.

## Where to look next

- `identity/SOUL.md` — the persona (Identity → Personality → Boundaries).
- `brain/MOC - turbo.md` — the brain index (the six expertise artifacts).
- `llms.txt` — the agent-readable map of every surface + the P-/S-/O- ID index.
- `CLAUDE.md` — the Claude Code operating doc for this repo (the voice + the law + the cluster order).
