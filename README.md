# turbo

> **The Energy fleet's backend / runtime domain-expert employee.** Scaffolds and audits TS-strict
> [Hono](https://hono.dev) services from an OpenAPI spec — Zod boundaries at every route, a dedicated
> no-default PATCH schema, typed `Result<T,E>` errors, SSE done safely, contract-tested routes. It designs
> the racy cross-request-state class of bug *out by construction*. Powered by Energy.

turbo is a **tool-employee**, not an app: it is consumed over **CLI + MCP** by coding agents and watched
through a local **cockpit** by a human. It owns **API/runtime only** — rate-limit / cache / KV / edge-store
is a sibling employee's seam (see [Boundary](#boundary)).

## What it does

Its acceptance test is one command:

```bash
turbo api --spec petstore.openapi.json --out ./service
```

→ a typed Hono service: Zod boundaries at every route, a **distinct no-default PATCH schema** (so a PATCH
never silently resets omitted fields — `P-04`), routes chained to one `AppType`, `/openapi.json` + Scalar UI,
a `/health` route, Pino JSON logs, an `hcWithType` client, and a runnable `contract` script — that passes
`tsc --noEmit` with zero errors and its own pitfall audit with zero `P-02`/`P-04`.

## Install

```bash
pnpm install && pnpm build
```

Requires **Node ≥ 22** (default 24). As a Claude Code plugin, point Settings → Plugins → Add local plugin
at this directory (or `claude plugin install turbo`) — see [`.claude-plugin/manifest.json`](.claude-plugin/manifest.json).

## CLI

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

## MCP

turbo ships **its own** MCP server (`turbo-mcp`) exposing the same operations as 8 JSON-RPC tools:
`scaffold_service` · `gen_from_openapi` · `audit_service` · `check_versions` · `contract_test` ·
`stream_doctor` · `explain_pitfall` · `search_brain`. Default transport is stdio
(`node dist/mcp/server.js`); a hosted `@hono/mcp` Streamable-HTTP variant serves the same 8 tools. See
[`.mcp.json`](.mcp.json) and the A2A card at [`.well-known/agent.json`](.well-known/agent.json).

## The brain

turbo is *opinionated*. Its expertise lives in [`brain/`](brain/) (six Wave-R artifacts) and is queryable
via `turbo brain` / `turbo explain`:

- [`OPINIONS.md`](brain/OPINIONS.md) — the anti-slop taste layer (ALWAYS X / NEVER Y, because Z, with an
  escape hatch). e.g. *default to Hono; Bun is a scalpel not a default; Result<T,E> consumption-enforced.*
- [`KNOWN-PITFALLS.md`](brain/KNOWN-PITFALLS.md) — the version-specific gotcha table (symptom → condition →
  detect → fix). e.g. `P-02` `new Map()` is now *racy* under Fluid Compute, not just empty; `P-04` Zod
  `.default()` data-loss on PATCH; `P-09` type-stripping ≠ type-check.

## The single taste

**In 2026, adopt the inversion AND read the asterisk.** Every "this is solved now" fix (cold-starts,
build-step, typed-RPC gap) is real but *moved* the risk rather than deleting it — into CI via `tsc --noEmit`,
into concurrency via Fluid, into the experimental column for native deps. turbo's edge is reading the asterisk.

## Boundary

turbo owns **API/runtime ONLY.** It emits the cache-control / ETag / `Vary` *header semantics* it owns and
stops — it never holds the store (the `new Map()` law forbids it anyway). Rate-limit / cache / KV /
edge-store belongs to a sibling employee's seam. turbo runs on the deploy host and exposes routes other
employees consume; it does not own their pipelines (frontend / mobile / DB schema / auth / billing /
deploy+CI).

## More

- [`AGENTS.md`](AGENTS.md) — the agent-facing operating guide (tool list, boundary, the NOT-list).
- [`llms.txt`](llms.txt) — the LLM index (skills, MCP, brain, P-/S-/O- ID index).
- [`CLAUDE.md`](CLAUDE.md) — voice, the law, the default stack, the build order.
- [`identity/SOUL.md`](identity/SOUL.md) — the full persona.

## License

MIT.
