---
title: "turbo TOOL-MATRIX — Canonical Tools, Defaults vs Alts, Agent-Access Surface, Required Secrets"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [tool-matrix, defaults, cli, api, mcp, secrets, env-vars, versions, backend, runtime]
synthesist: SYNTHESIS / taste-node (CP123 Wave-R)
sources: ["brain/research/raw/ecosystem-01,02,03,04,05,06,07,12,13.md", "brain/research/raw/field-03,05,06.md"]
summary: "The canonical tool table for turbo: per decision, the DEFAULT vs the ALT, when-to-use-which, the AGENT-ACCESS surface (CLI flags / API / MCP), the pinned VERSION (npm view 2026-06-11), and the ENV VARS / SECRETS each needs. The secrets column feeds the Wave-P Required-Secrets manifest — every secret here is a candidate row in .env.example."
---

# turbo TOOL-MATRIX

> **How to use.** Each section = one decision turbo's build waves make. **Bold row = default**; the alt rows name the
> exact condition to switch. The **Agent-access** column is what makes the tool *operable by a coding agent* (prefer
> JSON output + non-interactive flags). The **Secrets/env** column is load-bearing for Wave P: it's the source list
> for the Required-Secrets manifest. Versions are `npm view` live on 2026-06-11 — re-verify in the RSI loop
> (`npm view <pkg> version --json`).
>
> **The default stack in one line:** Hono ≥4.12.25 on Node 24 LTS · Zod 4.4 (Standard-Schema-bound) · `@hono/zod-openapi`
> 1.x (or oRPC external) · neverthrow 8.2 (+eslint-plugin) · `hcWithType` · SSE · Bun for CLIs/tests · ship Vercel-Node,
> promote latency-critical to Workers. (source: ecosystem-12)

---

## 1 — HTTP Framework
| Tool | Version | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|---|
| **Hono** ✅ | **4.12.25** | default framework | edge + multi-runtime + typed RPC (the harness mandate) | npm; runs on Node/Bun/Deno/Workers/Vercel/Lambda unmodified | none (framework) |
| Fastify | 5.8.5 | alt | long-lived **Node-only** monolith w/ rich OAuth/session + JSON-Schema-native | npm; `@fastify/swagger` for OpenAPI | none |
| Express | 5.2.1 | legacy-only | legacy interop / middleware that exists ONLY here. **Never new code.** | npm | none |
| NestJS | — | rare | big team wanting Angular-style DI (rarely turbo's call) | npm | none |

**Pin rule:** Hono **≥4.12.25** (security wave — treat <4.12.16 as vulnerable). Use `~4.12.25` or exact, not `^`. (source: ecosystem-01/02/12, field-02)

## 2 — Validation (the "Zod at every boundary" law)
| Tool | Version | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|---|
| **Zod** ✅ | **4.4.3** | default validator | every boundary; `z.toJSONSchema()` → OpenAPI | npm; `context7` for API surface | none |
| `zod/mini` | (in zod 4) | sub-variant | edge bundle size *measured*-critical (1.88kb) | import path `zod/mini` | none |
| Valibot | 1.4.1 | alt | bundle size is the binding constraint (sub-2kb tree-shaken) | npm; Standard Schema | none |
| ArkType | 2.2.0 | alt | want TS-syntax-as-schema + max runtime perf | npm; Standard Schema | none |

**Binding:** prefer `@hono/standard-validator` (Standard-Schema → swappable) when swappability matters; `@hono/zod-validator@0.8.0` for Zod-specific ergonomics. **PATCH:** dedicated no-default schema (PITFALL P-04). (source: ecosystem-03, GAPS Dispute F)

## 3 — API contract / RPC style
| Tool | Version | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|---|
| **Hono RPC (`hc`)** ✅ | (in hono) | internal default | on Hono + TS-only consumer | `hcWithType` export (never raw `hc`) | none |
| **oRPC** ✅ | `@orpc/server` 1.14.5 | external default | external/non-TS/mobile + rich types (native Date/URL/Set/Map) + first-class OpenAPI + CF-Workers | npm; emits real OpenAPI | none |
| `@hono/zod-openapi` | **1.4.0** | OpenAPI engine | pure REST, Zod→OpenAPI, least drift | serves `/openapi.json` + Scalar UI | none |
| ts-rest | `@ts-rest/core` 3.52.1 | alt | strict contract-first REST, oRPC feels too new | npm | none |
| tRPC | `@trpc/server` 11.17.0 | narrow | heavy TanStack Query TS monorepo (OpenAPI plugin deprecated + breaks Edge) | npm | none |
| chanfana | (CF) | Workers alt | CF-blessed OpenAPI for Workers-first | wrangler-deployed | none |

**Versioning:** URL-path `/v1` external, header internal, additive-only (OPINION O-10). (source: ecosystem-04, field-05)

## 4 — Error handling (the "Result<T,E>, no try-catch-swallow" law)
| Tool | Version | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|---|
| **neverthrow** ✅ | **8.2.0** | default Result lib | expected domain errors; `safeTry` for multi-step | npm | none |
| `eslint-plugin-neverthrow` | latest | **mandatory** | enforces every Result consumed (Rust `#[must_use]`) | lint config | none |
| Effect | 3.21.3 | heavy alt | genuinely Effect-shaped (system-wide concurrency/resource-safety) | npm | none |
| try-catch | (native) | boundary-only | wrap a thrower into a Result, or truly-fatal crash | — | none |

(source: ecosystem-05, PITFALL P-07/P-08)

## 5 — Runtime
| Tool | Version | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|---|
| **Node** ✅ | **24 LTS** (floor 22) | default core runtime | the core HTTP service — most stable, widest compat, runtime isn't the bottleneck | `node app.ts` native (Node 24); `tsc --noEmit` CI gate mandatory | none |
| **Bun** ✅ (selective) | 1.3.14 | scalpel | CLIs, `bun test`, edge/short-lived, WS-fan-out-no-native-addons | `bun test/run`, `bunx`; **pin version in CI** | none |
| Deno | 2.x | rare | want permission model / Deno Deploy / native TS+security | `deno` CLI | none |

**Node 20 is EOL (2026-04-30)** — do NOT target it. Bun: GREEN/YELLOW(soak ≥72h)/RED per OPINION O-05. (source: ecosystem-01/06/12, field-03/06)

## 6 — Edge / Deploy host (deploy seam — turbo must RUN on it, doesn't own the choice)
| Host | Cold start | Model | When | Agent-access | Secrets/env |
|---|---|---|---|---|---|
| **Vercel (Node fn)** ✅ | 200-800ms | full Node Lambda | energy default host; heavy/stateful single-region | `vercel logs -j` (JSON Lines), `vercel deploy --logs`, `vercel discover --format=json`, `vercel guide` | `VERCEL_TOKEN` (deploy/logs) |
| **Cloudflare Workers** | <5ms | V8 isolate, Web-API subset, 128MB/30-50ms-CPU, 330+ PoPs, Durable Objects/Sandboxes GA | global/spiky; edge state via DO/KV/D1 | `wrangler dev/deploy/tail`, `d1 execute`, `kv put`, `secret put` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; bindings in `wrangler.toml` |
| Vercel (Edge fn) | 50-250ms | V8 isolate | middle ground (being de-emphasized vs Workers) | `vercel` CLI | `VERCEL_TOKEN` |
| Fly.io | n/a | long-running Node container | persistent services/WebSockets at length | `fly` CLI | `FLY_API_TOKEN` |

**State at the edge:** KV / Durable Objects / D1 / Upstash only — never module memory (OPINION O-06). (source: ecosystem-07/12)

## 7 — Streaming
| Tool | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|
| **SSE via Hono `streamSSE`** ✅ | default | one-way LLM/agent output (matches Anthropic's wire format) | `hono/streaming`; headers incl. **`X-Accel-Buffering: no`** | none |
| WebSocket | alt | bidirectional — interrupts, tool-use, multi-agent, live collab | Hono WS helpers; **`ws`** (npm) for the *server* (native WS server still experimental) | none |

**Mandatory on every stream:** 3rd-arg error handler + `while (!stream.aborted)` + monotonic `id` + `: ping`/15s (OPINION O-12, PITFALL P-10/P-11). (source: ecosystem-08, field-06 §2)

## 8 — Contract testing
| Tool | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|
| **Hono RPC `typeof app` type** ✅ | compile-time contract (free) | internal TS-to-TS — breaking change = compile error | tsc | none |
| **OpenAPI runtime conformance** ✅ | provider-owned contract | external/non-TS — assert responses parse vs generated spec | Zod parse + `/openapi.json` | none |
| `oasdiff` / `openapi-diff` | spec-diff CI gate | fail build on breaking spec change between `/vN` revisions | CLI in CI | none |
| Pact (+ Pactflow broker) | consumer-driven | **selective** — many independent consumers relying on subsets/error-shapes the spec can't pin | Pact CLI + broker | `PACT_BROKER_TOKEN` (only if used) |

(source: ecosystem-09, field-04)

## 9 — Build / Test / Lint (the dev-loop tools)
| Tool | Version | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|---|
| **Vitest** ✅ | latest | default test runner | unit/integration (the reference starter uses it) | `vitest run` (non-interactive) | none |
| `bun test` | (in bun) | fast alt | even inside a Node project — fast, zero-config | `bun test` | none |
| `node --test` | (Node 20+ stable) | native alt | drop `jest`/`mocha` for basic suites (3rd-party still win on snapshots/mocking) | `node --test` | none |
| `tsc --noEmit` | (typescript) | **mandatory gate** | type-check that native strip-types does NOT do | CI step | none |
| ESLint + `eslint-plugin-neverthrow` | latest | lint + Result enforcement | every repo | `eslint .` | none |

(source: ecosystem-10/13, field-06 §1/§2)

## 10 — Logging / Observability (build it IN — agent-operability)
| Tool | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|
| **Pino / `hono-pino`** ✅ | structured JSON logs | every service (NOT `console.log` prose) | JSON an agent greps/parses | none (or log-sink token if shipped) |
| `vercel logs -j` | prod log read | after deploy, verify | JSON Lines → `jq` | `VERCEL_TOKEN` |
| `wrangler tail` | Workers live logs | runtime errors on Workers | streaming | `CLOUDFLARE_API_TOKEN` |
| OpenTelemetry | tracing | when distributed tracing needed (Bun support newer/experimental — a Bun tax) | OTLP exporter | `OTEL_EXPORTER_OTLP_*` (if used) |

(source: ecosystem-13, field-03)

## 11 — Agent-operability MCP layer (turbo's services + the agent's tools)
| Tool | Role | When | Agent-access | Secrets/env |
|---|---|---|---|---|
| **`@hono/mcp`** ✅ | turbo's service BECOMES an MCP server | expose turbo's capabilities as MCP tools to other agents (satisfies the MCP component) | `StreamableHTTPTransport`, deployable to Workers, stateless | none (auth-light); `simpleMcpAuthRouter` for 3rd-party-auth |
| `cloudflare/workers-mcp` | expose a Worker's fns to Claude | Worker methods → LLM/Claude Desktop | `npm run deploy` updates Worker + Claude metadata | `CLOUDFLARE_API_TOKEN` |
| `docs.mcp.cloudflare.com/mcp` | TEACH the agent Workers | building on Workers — current API knowledge vs stale training | attach to Claude Code/Cursor | none |
| `context7` (inherited) | real package API surface | avoid hallucinated method signatures | `.mcp.json` | (per `.mcp.json`) |
| `github`/`memory`/`obsidian` (inherited) | ecosystem watch / brain / persistence | RSI ecosystem watch (`gh search issues`), brain reads | `.mcp.json` | `GITHUB_PERSONAL_ACCESS_TOKEN` |

**Gotcha:** accessing Hono `Context` inside an `@hono/mcp` tool def is awkward — pass needs explicitly (PITFALL P-13). (source: ecosystem-13)

## 12 — Reference / Scaffold repos (mine these, don't hand-roll)
| Repo | ★ | Role | When | Caveat |
|---|---|---|---|---|
| **`w3cj/hono-open-api-starter`** ✅ | 997 | THE reference skeleton | scaffold a law-compliant service (Hono+zod-openapi+Drizzle+Pino+Scalar+Vitest+file-split) | last push Oct 2025 → bump `@hono/zod-openapi`→1.x, Zod→4.4.3, Hono→≥4.12.25 first |
| `AmanVarshney01/create-better-t-stack` | 5,452 | THE scaffolder | generate a known-good baseline + diff its choices vs the law | most active scaffolder (push 2026-06-10) |
| `honojs/examples` | 835 | THE cookbook | "how do I do X on runtime Y with Hono" before hand-rolling | official, multi-runtime |
| `cloudflare/chanfana` | 741 | OpenAPI engine | Workers-first CF-blessed OpenAPI | alt to `@hono/zod-openapi` |
| `rhinobase/honohub` | 463 | real-app reference | see the stack at scale (CMS: auth/admin/CRUD) | non-trivial composition |

**Boundary flag:** `rhinobase/hono-rate-limiter` (642★) is **echo's** territory (rate-limit/cache), not turbo's. (source: ecosystem-10)

---

# REQUIRED-SECRETS MANIFEST (feed to Wave P → `.env.example`)
The minimal set turbo needs, by capability. **Most of the stack needs NO secrets** (Hono/Zod/neverthrow/Vitest are libraries). Secrets appear at the *deploy/observability/MCP* edges:

| Secret / env | Needed for | Required? | Notes |
|---|---|---|---|
| `VERCEL_TOKEN` | `vercel deploy/logs/discover` (energy default host) | **yes** (if Vercel-deployed) | already energy's deploy path |
| `CLOUDFLARE_API_TOKEN` | `wrangler deploy/tail`, Workers, workers-mcp | yes (if Workers-deployed) | + `CLOUDFLARE_ACCOUNT_ID` |
| `CLOUDFLARE_ACCOUNT_ID` | wrangler account scoping | yes (if Workers) | non-secret but required |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | `gh` ecosystem watch (RSI), github MCP | yes (RSI loop) | already in energy `.env.example` |
| `ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN` | the Claude half of the RSI loop (dsip.json) | yes (RSI Claude half) | dsip: deterministic half is $0/tokenless; Claude half lights when token set |
| (Node version) `engines.node` `>=22` | runtime floor | yes | **NOT a secret** — config; verify Vercel min at build (GAP Gap-1) |
| Bun version pin (CI) | `bun install --production` stability | yes (if Bun in CI) | **NOT a secret** — pin in CI config (PITFALL P-14) |
| `PACT_BROKER_TOKEN` | Pact consumer-driven contract tests | **no** (only if Pact used selectively) | most contracts = free RPC-type + OpenAPI conformance |
| `OTEL_EXPORTER_OTLP_ENDPOINT` (+headers) | OpenTelemetry tracing | no (only if OTel adopted) | Bun OTel support is newer/experimental |
| Upstash / Supabase creds | **echo's** rate-limit/cache external store | **no — echo owns this** | turbo defines cache-control/ETag semantics; echo holds the store creds |

**Seam note:** turbo's *own* secret footprint is small — deploy tokens + the RSI tokens. The state-store secrets (Upstash/Supabase) belong to **echo** (Wave-2 rate-limit/cache). turbo MUST NOT hold cross-request state, so it MUST NOT need a state-store secret (energy `new Map()` law). (source: ecosystem-04/07/13, dsip.json, .env.example)

---

## The agent-operability meta-point (carry this)
A backend is **agent-native** when every operation an agent must perform — deploy, read logs, inspect the contract,
call the API, extend it — has a **deterministic, JSON-emitting, non-interactive** path, AND the service can itself
**speak MCP**. Vercel + Cloudflare both shipped explicit agent-CLI surfaces in 2026 (`vercel logs -j`,
`vercel discover --format=json`, `wrangler tail`, the docs MCPs); `@hono/mcp` closes the loop by letting turbo's own
services BE MCP servers. Treat agent-operability as a first-class build requirement, not an afterthought. (source: ecosystem-13, OPINION O-13)
