---
title: "What an AGENT (not a human) Needs to Operate the Backend Stack — CLIs, APIs, MCP Servers (June 2026)"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [agent, cli, mcp, wrangler, vercel, hono-mcp, tooling, operability]
sources:
  - "WebSearch: @hono/mcp, cloudflare/workers-mcp, wrangler commands, vercel CLI agent-optimized (2026-06-11)"
  - "https://jsr.io/@hono/mcp ; https://github.com/cloudflare/workers-mcp ; developers.cloudflare.com/agents"
  - "vercel.com/changelog (vercel logs/discover optimized for agents)"
summary: "The agent-operability layer turbo needs: deterministic CLIs with JSON output (wrangler, vercel -j, npm view), the docs MCP servers that teach agents the platform (docs.mcp.cloudflare.com), and @hono/mcp so turbo's OWN services can expose MCP. This is the bridge from 'backend stack' to 'agent-native backend stack.'"
---

# Why this file exists
turbo isn't built for a human dev — it's a **domain-expert employee harness** operated by coding agents. So the
stack must be **agent-operable**: deterministic CLIs (parseable output, non-interactive flags), MCP servers that
either *control* the platform or *teach* the agent about it, and the ability for turbo's own services to *be*
MCP servers. This is the difference between "a backend" and "an agent-native backend."

---

# 1. CLIs an agent drives (prefer JSON output, non-interactive flags)

## `npm view <pkg> <field> --json` — the version oracle
The cheapest, most deterministic way for an agent to know **current versions + release dates** without scraping.
Used throughout this research (`npm view hono version time --json`, `dist-tags --json`). turbo's nightly RSI
loop should `npm view` its dependency set to detect drift. **Always `--json`** for parseability.

## `wrangler` — the Cloudflare Workers CLI (agent-operable)
Single CLI for Workers + KV + R2 + D1 + Vectorize + Hyperdrive + Queues + Workflows + Secrets.
- `wrangler dev` (local), `wrangler deploy` (ship), **`wrangler tail`** (live logs — agent reads runtime errors).
- D1: `wrangler d1 execute <db> --command "SELECT ..."`, `wrangler d1 export <db> --output backup.sql`.
- KV: `wrangler kv:key put --namespace-id <id> "k" "v"`, `wrangler kv:bulk put <data.json>`.
- `wrangler secret put <NAME>` — secret mgmt (never put secrets in `wrangler.toml`).
- **Agent note:** there's a published **`wrangler` agent-skill** (mcpservers.org / lobehub) — an agent can be
  taught wrangler as a skill. Config lives in `wrangler.toml` (bindings for KV/DO/D1 must be declared there or
  the isolate won't have them — a common deploy failure).

## `vercel` — NOW explicitly agent-optimized (2026 changelog)
Vercel rebuilt CLI surfaces *for agent workflows*:
- **`vercel logs <url|id> -j`** (`--json`) → **JSON Lines** output, pipe to `jq`. Rebuilt with **historical log
  querying** "designed with agent workflows in mind." This is how turbo's agent reads prod errors after deploy.
- **`vercel deploy --logs`** → stream build logs.
- **`vercel discover --format=json`** + **`vercel guide`** → an agent can **autonomously discover, install, and
  get setup instructions for Vercel Marketplace integrations** (databases, auth, logging) end-to-end,
  non-interactively. This is a genuine agent-native primitive — turbo can wire its own infra (echo's Upstash, a
  Postgres) via these without a human.
- Structured output also on: `inspect`, `env`, `project`, `activity`, `usage`. **Always `--json`/`-j`.**
- (Matches energy's auto-deploy rule: push to main auto-deploys; `vercel logs -j` is the verify step.)

## `gh` — GitHub CLI (agent's eyes on the ecosystem)
Used here for `gh search repos/issues`, `gh api repos/...`, `gh issue view --json`. turbo's RSI "ecosystem
watch" (per dsip.json `externalIntelligence`) runs on `gh search issues` over its dependency repos to catch
breakage early. **Gotcha learned this session:** `gh search issues` field is `commentsCount` (not `comments`);
multi-word quoted queries match literally and often return empty — use single keywords + `--sort`.

## `bun` — agent-friendly all-in-one
`bun test` (fast, zero-config), `bun run`, `bunx`. Good for turbo's `tools/` CLIs and CI. Pin the version.

---

# 2. MCP servers that CONTROL or TEACH the platform

## `@hono/mcp` — turbo's services can BE MCP servers  [most important for turbo]
`@hono/mcp` (on npm + JSR; the transport landed in **Hono v4.8.0**) exposes a **`StreamableHTTPTransport`** so a
Hono app becomes a **remote MCP server over Streamable HTTP** — the current MCP spec transport.
```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPTransport } from '@hono/mcp'
const app = new Hono()
const mcp = new McpServer({ name: 'turbo', version: '1.0.0' })
// register tools on mcp ...
app.all('/mcp', async (c) => {
  const transport = new StreamableHTTPTransport()
  await mcp.connect(transport)
  return transport.handleRequest(c)   // stateless; deployable to Workers
})
```
- Ships `simpleMcpAuthRouter` for third-party-auth MCP. Currently best for **stateless, auth-light remote MCP**.
- **Why it matters:** this is how turbo satisfies the energy checklist's MCP component ("≥1 real own server,
  dual-mode stdio+hosted") — turbo's API surface can expose its own capabilities as MCP tools to other agents,
  deployable to Workers. Reference impl: `mhart/mcp-hono-stateless` (Streamable HTTP, CF-Workers-adapted).
- Context gotcha: accessing the Hono `Context` inside an `@hono/mcp` tool definition is awkward (honojs
  discussion #4452) — pass what the tool needs explicitly rather than reaching for `c`.

## `cloudflare/workers-mcp` — expose a Worker's functions to Claude
A Node proxy that handles stdio locally and calls your deployed Worker's methods → "expose any function/API in
your app back to an LLM in your coding agent / Claude Desktop." `npm run deploy` updates both the live Worker
AND Claude's metadata about the function. Two server styles: **stateless `createMcpHandler()`** (simple tools) vs
**stateful `McpAgent` on Durable Objects** (per-session memory). turbo uses stateless unless a tool needs
cross-call session state.

## `docs.mcp.cloudflare.com/mcp` — TEACH the agent the platform
Cloudflare ships a **docs MCP server**; connecting it to Cursor/VS Code/**Claude Code**/Codex "teaches your agent
about Workers." This is the inverse of a control MCP — it's a *knowledge* MCP so the agent writes correct Workers
code. **turbo action:** when building on Workers, attach the CF docs MCP so the agent has current API knowledge
rather than stale training data. (Anthropic/MCP ecosystem analog: attach the relevant docs MCP for whatever
platform a task targets.)

## Inherited MCP servers (turbo's `.mcp.json`)
turbo already wires `github`, `context7` (library docs — agent fetches current API surface), `memory`,
`obsidian` (its own `brain/` vault). `context7` is the agent's "look up the real API of package X" tool — use it
to avoid hallucinated method signatures (complements `npm view` for versions).

---

# 3. The agent-operability checklist for any turbo service (what to build IN)
- [ ] **Structured logging** (Pino / `hono-pino`) → JSON logs an agent can grep/parse (NOT `console.log` prose).
- [ ] **`/openapi.json`** served + Scalar/Swagger UI → the agent (and any consumer) can introspect the contract.
- [ ] **`/health`** endpoint → agent verifies deploy (curl → 200), per energy deploy-verify rule.
- [ ] **Typed errors mapped to HTTP** (neverthrow → `mapErrorToResponse`) → predictable, parseable error bodies.
- [ ] **`hcWithType` export** → TS consumers (and agent-written clients) get fast, correct types.
- [ ] **`@hono/mcp` endpoint** (when the service should expose tools to other agents) → agent-native by design.
- [ ] **Deterministic CLI scripts** in `package.json` (`build`, `test`, `dev`, `deploy`) with non-interactive
      flags → an agent runs them headless.
- [ ] **Pinned dependency versions** + a `npm view`-based drift check in the RSI loop → no surprise breakage.

# The meta-point
A backend is "agent-native" when **every operation an agent must perform — deploy, read logs, inspect the
contract, call the API, extend it — has a deterministic, JSON-emitting, non-interactive path**, and when the
service can itself **speak MCP**. Vercel and Cloudflare both shipped explicit agent-CLI surfaces in 2026
(`vercel logs -j`, `vercel discover --format=json`, `wrangler tail`, the docs MCPs); `@hono/mcp` closes the loop
by letting turbo's own services be MCP servers. turbo should treat agent-operability as a first-class build
requirement, not an afterthought.
