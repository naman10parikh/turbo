# turbo

<!-- fleet:header:start -->
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE) [![Agent-native](https://img.shields.io/badge/agent--native-yes-2f5d8a?style=flat-square)](AGENTS.md) [![MCP server](https://img.shields.io/badge/MCP-server-1e3f60?style=flat-square)](#use-it-from-any-coding-agent) [![Skills](https://img.shields.io/badge/skills-5-2f6b4f?style=flat-square)](skills/)

**Turns an OpenAPI spec into a strict TypeScript Hono service and audits it for production bugs.**

Turbo is an agent-native, recursively self-improving agent employee whose job is backend and runtime. Coding agents use it through its skills, its MCP server and its command line. It improves itself through its own evals and a scheduled improvement loop, and a person reviews every change.

[AGENTS.md](AGENTS.md) · [llms.txt](llms.txt) · [Skills](skills/) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [All projects](https://github.com/naman10parikh)
<!-- fleet:header:end -->

Turbo is a backend engineer for coding agents. Give it an OpenAPI spec and it writes a typed
[Hono](https://hono.dev) service in strict TypeScript: Zod checks at every route, a separate PATCH schema so a PATCH
never resets omitted fields, typed `Result<T,E>` errors, safe streaming and contract-tested routes. It also audits
existing services for the bugs that ship to production, such as module-level caches that leak state between requests
on serverless hosts. It is for agents and teams that build APIs, and it owns the API and the runtime only. Powered by
Energy.

<!-- fleet:use:start -->
## Use it from any coding agent

**Claude Code**: the plugin brings the skills, sub-agents, hooks and MCP server.

```
/plugin marketplace add naman10parikh/turbo
/plugin install turbo@turbo
```

**Its MCP server**, in any MCP client:

```bash
claude mcp add --transport stdio turbo -- npx -y -p github:naman10parikh/turbo turbo-mcp
codex mcp add turbo -- npx -y -p github:naman10parikh/turbo turbo-mcp
```

Cursor (`.cursor/mcp.json`), Gemini CLI (`.gemini/settings.json`) and most other clients take the same command as JSON:

```json
{
  "mcpServers": {
    "turbo": {
      "command": "npx",
      "args": [
        "-y",
        "-p",
        "github:naman10parikh/turbo",
        "turbo-mcp"
      ]
    }
  }
}
```

**Gemini CLI**: the extension brings the context and the MCP server.

```bash
gemini extensions install https://github.com/naman10parikh/turbo
```

**One skill** (5 in all, in [skills/](skills/)), in any agent that reads Agent Skills:

```bash
gemini skills install https://github.com/naman10parikh/turbo --path skills/scaffold-hono-service
git clone --depth 1 https://github.com/naman10parikh/turbo /tmp/turbo && cp -r /tmp/turbo/skills/scaffold-hono-service ~/.claude/skills/
```

**The command line:**

```bash
npx -y -p github:naman10parikh/turbo turbo --help
```

Codex, Cursor, OpenCode, GitHub Copilot and other agents read [AGENTS.md](AGENTS.md); Claude Code reads [CLAUDE.md](CLAUDE.md) and Gemini CLI reads [GEMINI.md](GEMINI.md), which import it. [llms.txt](llms.txt) maps every surface for agents that read first.
<!-- fleet:use:end -->

## Quick start

In one step, straight from GitHub:

```bash
npx -y -p github:naman10parikh/turbo turbo --help
```

From a clone (Node 22 or later, pnpm):

```bash
git clone https://github.com/naman10parikh/turbo && cd turbo
pnpm install && pnpm build
node dist/cli/index.js api --spec eval/fixtures/petstore.openapi.json --out /tmp/turbo-demo
node dist/cli/index.js audit /tmp/turbo-demo
node dist/cli/index.js explain P-04
pnpm test
```

`api` writes a 4-route Petstore service in under a second, and `audit` finds 0 pitfalls in it. In the generated
service, `npm install && npx tsc --noEmit && npm run contract` passes with 0 type errors and 3 of 3 contract tests.

## How it works

Its acceptance test is one command, `turbo api --spec petstore.openapi.json --out ./service`. It produces a typed Hono service: Zod boundaries at every route, a **distinct no-default PATCH schema** (so a PATCH never silently resets omitted fields, `P-04`), routes chained to one `AppType`, `/openapi.json` plus Scalar UI, a `/health` route, Pino JSON logs, an `hcWithType` client, and a runnable `contract` script. The result passes `tsc --noEmit` with zero errors and turbo's own pitfall audit with zero `P-02` and `P-04` findings.

**The CLI.**

| Command | What it does |
|---|---|
| `turbo api --spec <openapi> [--out <dir>] [--runtime node\|workers] [--json]` | **The acceptance test** — OpenAPI → typed Hono service, contract tests green. |
| `turbo scaffold [--name <n>] [--out <dir>]` | Stand up a blank law-compliant Hono service (w3cj baseline, deps bumped to current pins). |
| `turbo audit <dir> [--json]` | Run the KNOWN-PITFALLS detectors over a service (`P-02` module-scope `new Map()`, `P-04` defaulted PATCH, `P-09` missing `tsc` gate, SSE/RPC/CORS), findings keyed by P-ID. |
| `turbo check [--json]` | Version-drift oracle: stale pins, the Hono security floor, EOL runtimes. Offline-safe. |
| `turbo contract <dir> [--diff <old-spec>]` | Contract-test a service vs its `/openapi.json` + RPC type. |
| `turbo stream-doctor <file>` | Audit an SSE route for the streaming traps (missing 3rd-arg handler, `X-Accel-Buffering: no`, `while(!aborted)`). |
| `turbo migrate-plan <dir> --to <fastify\|hono>` | Emit a Strangler-Fig (wrap-then-strangle) migration plan — never big-bang. |
| `turbo brain <query>` | BM25 ranked search over the [`brain/`](brain/) expertise corpus. |
| `turbo explain <P-id\|S-id\|O-id>` | Print a pitfall/scenario/opinion by ID with its detection + fix. |
| `turbo eval [--level 1\|2\|3]` | Run the Hamel eval pyramid L1/L2/L3 over the golden tasks (G1–G13). |

`turbo --help` lists every command; data commands accept `--json`.

**The MCP server.**

turbo ships **its own** MCP server (`turbo-mcp`) exposing the same operations as 8 JSON-RPC tools:
`scaffold_service` · `gen_from_openapi` · `audit_service` · `check_versions` · `contract_test` ·
`stream_doctor` · `explain_pitfall` · `search_brain`. Default transport is stdio
(`node dist/mcp/server.js`); a hosted `@hono/mcp` Streamable-HTTP variant serves the same 8 tools. The root
[`.mcp.json`](.mcp.json) starts it from GitHub, and the A2A card is at [`.well-known/agent.json`](.well-known/agent.json).

**The brain.**

turbo is *opinionated*. Its expertise lives in [`brain/`](brain/) (six Wave-R artifacts) and is queryable
via `turbo brain` / `turbo explain`:

- [`OPINIONS.md`](brain/OPINIONS.md) — the anti-slop taste layer (ALWAYS X / NEVER Y, because Z, with an
  escape hatch). e.g. *default to Hono; Bun is a scalpel not a default; Result<T,E> consumption-enforced.*
- [`KNOWN-PITFALLS.md`](brain/KNOWN-PITFALLS.md) — the version-specific gotcha table (symptom → condition →
  detect → fix). e.g. `P-02` `new Map()` is now *racy* under Fluid Compute, not just empty; `P-04` Zod
  `.default()` data-loss on PATCH; `P-09` type-stripping ≠ type-check.

**The single taste.**

**In 2026, adopt the inversion AND read the asterisk.** Every "this is solved now" fix (cold-starts,
build-step, typed-RPC gap) is real but *moved* the risk rather than deleting it — into CI via `tsc --noEmit`,
into concurrency via Fluid, into the experimental column for native deps. turbo's edge is reading the asterisk.

**The weekly loop.** Every Monday at 09:00 UTC, `.github/workflows/rsi.yml` installs and builds turbo, runs the six DSIP steps (re-verify the tool matrix, run the eval pyramid, propose a pin bump, validate it, never ship it), and keeps the proposal as a run artifact for a person to review.

**Boundary.**

turbo owns **API/runtime ONLY.** It emits the cache-control / ETag / `Vary` *header semantics* it owns and
stops — it never holds the store (the `new Map()` law forbids it anyway). Rate-limit / cache / KV /
edge-store belongs to a sibling employee's seam. turbo runs on the deploy host and exposes routes other
employees consume; it does not own their pipelines (frontend / mobile / DB schema / auth / billing /
deploy+CI).

<!-- fleet:anatomy:start -->
<!-- fleet:anatomy:end -->

## More

- [`AGENTS.md`](AGENTS.md) — the agent-facing operating guide (tool list, boundary, the NOT-list).
- [`llms.txt`](llms.txt) — the LLM index (skills, MCP, brain, P-/S-/O- ID index).
- [`CLAUDE.md`](CLAUDE.md) — voice, the law, the default stack, the build order.
- [`identity/SOUL.md`](identity/SOUL.md) — the full persona.

<!-- fleet:footer:start -->
## How it improves itself

It carries its own evals and a self-improvement contract, [`dsip.json`](dsip.json) (level L2). A scheduled loop runs the evals, tries a change in a sandbox and opens it for review. A change that lowers a score is not merged, and a person merges every change. Lessons it learns are kept as rules in its memory files.

## Part of a fleet

One of the agent-native, recursively self-improving open-source projects by [Naman Parikh](https://github.com/naman10parikh). Each one is an agent employee that owns one part of an agent's harness or of the product around it.

Siblings: [agentdial](https://github.com/naman10parikh/agentdial) (identity) · [wikimem](https://github.com/naman10parikh/wikimem) (memory) · [skillsmith](https://github.com/naman10parikh/skillsmith) (skills) · [agent-booster](https://github.com/naman10parikh/agent-booster) (tools / CLIs) · [armory](https://github.com/naman10parikh/armory) (MCPs and the component registry) · [agentgrid](https://github.com/naman10parikh/agentgrid) (dispatch) · [agentswarm](https://github.com/naman10parikh/agentswarm) (dispatch) · [agentbench](https://github.com/naman10parikh/agentbench) (evals) · [agentmoney](https://github.com/naman10parikh/agentmoney) (observability) · [claude-harness](https://github.com/naman10parikh/claude-harness) (the whole harness, as a template).

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md); AI-assisted pull requests are welcome. Report a vulnerability privately, as [SECURITY.md](SECURITY.md) explains.

## License

MIT, © 2026 Naman Parikh. See [LICENSE](LICENSE).
<!-- fleet:footer:end -->
