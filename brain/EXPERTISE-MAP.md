---
title: "turbo EXPERTISE-MAP — Everything the Backend/Runtime Employee Must Master"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [expertise-map, backend, runtime, hono, zod, node, bun, edge, api-design, streaming]
synthesist: SYNTHESIS / taste-node (CP123 Wave-R)
sources: ["brain/research/raw/ecosystem-*.md", "brain/research/raw/field-*.md"]
summary: "The map of mastery for turbo, organized by JOB-TO-BE-DONE (not by tool). A fresh Claude session that reads this + the five sibling artifacts becomes dangerous in TS-strict backend/runtime work. Every node cites its raw source file."
---

# turbo EXPERTISE-MAP — by Job-To-Be-Done

> **How to read this.** turbo is the backend/runtime domain-expert *employee*, operated by coding agents, deploying
> product surfaces to Vercel-Node + Cloudflare-Workers. This file is the skeleton of what it must know, grouped by
> the *job* it's doing, not by the *tool* it reaches for. Each node points to the raw file that grounds it and to the
> sibling artifact (OPINIONS / PITFALLS / SCENARIOS / TOOL-MATRIX / GAPS) that goes deeper.
>
> **The one-line default stack** (memorize this; everything below is the *why*):
> **Hono ≥4.12.25 on Node 24 LTS · Zod 4.4 at every boundary (Standard-Schema-bound, swappable) · OpenAPI-first via
> `@hono/zod-openapi` 1.x (or oRPC for external rich-type APIs) · neverthrow 8.2 Result everywhere (+eslint-plugin) ·
> `hcWithType` not raw `hc` · TS project references for monorepo RPC · SSE for streaming · Bun for CLIs/tests · ship
> to Vercel-Node, promote latency-critical routes to Workers.** Rate-limit/cache = echo's seam, external store only.
> (source: ecosystem-12)

---

## The law turbo serves (non-negotiable, inherited from energy, read-only)
From `~/energy/.claude/rules/typescript.md` — turbo cannot violate these:
- No `any`, no `as unknown`, no non-null assertions unless proven safe. `interface` over `type` for object shapes.
- **Zod for runtime validation at every API boundary.**
- **Result<T,E> pattern, never try-catch-swallow.** Every catch: `console.warn("[module] context:", err.message)` or `// Intentionally silent: [reason]`.
- Async: always handle rejections, never fire-and-forget.
- Files < 400 lines. Named exports only. No default exports. `const` over `let`. No `var`.
- **NEVER `new Map()` for cross-request state in Vercel API routes** — externalize (Upstash/Supabase) or pass IDs from client.

This map exists to make turbo *expert enough to obey these correctly* — the law states the rule; the brain states the mechanism, the trap, and the fix. (source: ecosystem-00, field-00)

---

## JOB 1 — Choose the runtime + pin the right versions
*"Which runtime does this surface run on, and what versions are safe TODAY?"*

- **1.1 Node version floor/default.** Node 20 hit **EOL 2026-04-30** — the checklist's "Node 20+" is STALE. Floor = **22** (maintenance → Apr 2027), default = **24 (Krypton, Active LTS → Oct 2027)**. (source: ecosystem-01 → see PITFALL P-01)
- **1.2 Native TS type-stripping (Node 24 default).** `node app.ts` Just Works → ~9× faster cold start (1.4s→sub-200ms), zero build step. **BUT it does NOT type-check** → turbo *requires* a separate `tsc --noEmit` CI gate to keep the "no any" law. Breaks `enum`/value-`namespace`/decorators/JSX; ignores `paths`. (source: field-06 §1, §8 → OPINION O-09, PITFALL P-09)
- **1.3 Node-native replaces a dependency class.** `fetch`/`node:test`/`fs.glob`/`crypto.randomUUID` are STABLE — drop the deps (supply-chain win). `--env-file`/`node:sqlite`/client-`WebSocket` are EXPERIMENTAL — keep `dotenv`/community-sqlite/`ws`(server) for the gaps. (source: field-06 §2 → TOOL-MATRIX)
- **1.4 Bun: when it's safe.** GREEN for CLIs/`bun test`/edge/short-lived/WS-fan-out-no-native-addons. YELLOW (soak-test ≥72h) for always-on. RED for heavy node-gyp/payments-grade/PM2/inspector-debug. The perf edge collapses to **~3%** under a real DB. (source: ecosystem-06, field-03 → OPINION O-05, SCENARIO S-04/S-05)
- **1.5 Edge vs serverless runtime model.** Workers = V8 isolate, <5ms cold, Web-API subset (`nodejs_compat`), 128MB/30-50ms-CPU, 330+ PoPs. Vercel-Node = full Node Lambda, 200-800ms cold. **Hono is the bridge** — same code runs on both. (source: ecosystem-07 → TOOL-MATRIX, OPINION O-06)
- **1.6 The runtime is almost never your bottleneck.** DB-bound workloads converge across Node/Bun/Deno AND across Hono/Fastify/Express. Profile turbo's *own request shape* before believing any RPS claim. (source: field-02 DISPUTE 2, field-03 → GAPS Dispute B)

## JOB 2 — Stand up the HTTP service (framework + structure)
*"What framework, and how do I lay out files so RPC inference AND the <400-line law both hold?"*

- **2.1 Default framework = Hono ≥4.12.25.** Web-Fetch primitives (runs on edge unmodified), RegExpRouter speed, first-party typed RPC, tiny + near-zero deps. (source: ecosystem-02, ecosystem-12 → OPINION O-02)
- **2.2 When NOT Hono.** Long-lived Node-only monolith with rich OAuth/session needs → **Fastify** (deepest plugins, JSON-Schema-native, leanest issue count). Hono's "critical missing piece is complex session stores and OAuth flows." Never start new on Express. (source: field-02 DISPUTE 1, field-06 §7 → GAPS Dispute A)
- **2.3 The convergent practitioner architecture.** Two independent practitioners land on the *same* split: **Fastify monolith + Hono edge** — it's not Hono-vs-Fastify, it's by-layer. (source: field-02 TASTE 2)
- **2.4 File layout that reconciles "chain `.route()`" with "<400 lines".** Per route-group: `{name}.routes.ts` (definitions) · `{name}.handlers.ts` (logic) · `{name}.index.ts` (router) · `{name}.test.ts`, then chain all sub-apps in ONE composition file that exports `AppType`. (source: ecosystem-10 #1 w3cj starter → PITFALL P-03)
- **2.5 The reference skeleton.** `w3cj/hono-open-api-starter` wires the *entire* law (Zod-boundary + typed routes + OpenAPI + Pino + Vitest + file-split) — use as baseline, but bump deps first (last push Oct 2025). (source: ecosystem-10 → SCENARIO S-10)

## JOB 3 — Validate at every boundary (Zod)
*"Parse untrusted data into typed data, once, at the edge — and never re-check downstream."*

- **3.1 What a "boundary" is.** Every place untrusted data enters typed code: HTTP body/query/params/headers, env vars, DB rows read back, 3rd-party responses, queue messages, file contents. Rule: **parse, don't validate.** (source: ecosystem-03)
- **3.2 Zod 4.4 is the default.** 14× faster string parsing, 2.3× smaller, 10× fewer tsc instantiations than v3 — the v3 IDE-perf pain is largely solved. `zod/mini` (1.88kb) for edge bundles only. (source: ecosystem-03, ecosystem-01)
- **3.3 The PATCH data-loss trap (the dangerous one).** Zod 4 `.default()` applies on `undefined` *unconditionally, even on `.partial()`* → reusing a create-schema for PATCH silently overwrites omitted fields with defaults = **DATA LOSS**. Maintain a dedicated no-default PATCH schema. (source: ecosystem-03 TRAP 1 → PITFALL P-04, SCENARIO S-02, OPINION O-04)
- **3.4 The v3→v4 migration breaks.** `z.coerce.*` input is now `unknown`; string-format validators moved top-level (`z.email/url/uuid`) and `z.uuid()` is RFC-strict (rejects non-canonical UUIDs that v3 passed); error API collapsed to one `error` param + `z.prettifyError`; `.merge()` removed → `.extend()`. (source: ecosystem-03 TRAPs 2-5 → PITFALL P-05)
- **3.5 Standard Schema makes the validator swappable.** Zod/Valibot/ArkType implement `~standard`; Hono/tRPC/TanStack consume it. Bind via `@hono/standard-validator` to keep Zod→Valibot a package swap (no route-code change) when bundle size becomes binding. (source: ecosystem-03 → OPINION O-04, TOOL-MATRIX)

## JOB 4 — Design the API contract (REST vs RPC, OpenAPI, versioning)
*"Who consumes this — our own TS app, or mobile/Python/third-parties? Route by consumer."*

- **4.1 The core axis.** RPC (typed, zero-codegen, TS-consumer-only) vs REST+OpenAPI (language-neutral spec, external consumers). turbo will build both → must know all four contenders. (source: ecosystem-04)
- **4.2 Routing table.** Internal TS-only → **Hono RPC** (`hc`). External/mobile/non-TS/rich-types → **oRPC** (native Date/URL/Set/Map + first-class OpenAPI) or ts-rest. Pure REST no client → Hono routes + `@hono/zod-openapi`. tRPC only if heavy TanStack Query (its OpenAPI plugin is deprecated + breaks on Edge). (source: ecosystem-04, field-05 → OPINION O-07, TOOL-MATRIX)
- **4.3 OpenAPI-FIRST prevents drift.** The spec is the single source of truth. turbo default = **Zod → OpenAPI via `@hono/zod-openapi`** (one schema = runtime validation + published contract + typed client, least drift). Serve `/openapi.json` + Scalar/Swagger UI. (source: ecosystem-04 → OPINION O-08)
- **4.4 Versioning.** **URL-path `/v1` for external** (edge-cacheable, self-documenting, curl-able). **Header for internal** service-to-service. Additive-only within a major; breaking ⇒ `/vN+1`. (source: ecosystem-04, field-04 → OPINION O-10)
- **4.5 Version sprawl + the contract-test gap.** Path versioning averages **2.3 zombie versions/service** — write the sunset policy on day 1. And **60% of teams version but only 17% contract-test** — versioning without Zod-enforced contracts is theater; be the 17%. (source: field-04 → SCENARIO S-06, OPINION O-11)
- **4.6 Date-based (Stripe) versioning is gold at Stripe scale, an over-engineering trap below it.** Even Stripe admits "every new version is more code to maintain"; no credible small-scale success report exists. Don't cargo-cult it. (source: field-04 → GAPS Dispute C, OPINION O-10)

## JOB 5 — Handle errors the typed way (Result<T,E>)
*"No throw-and-move-on. Every expected failure is a typed Result; the catch lives inside the converter."*

- **5.1 The decision.** `try-catch` ONLY at the boundary to wrap a thrower into a Result (or truly-fatal crashes). **neverthrow 8.2** = default for expected domain errors. **Effect 3.21** only for genuinely Effect-shaped work (system-wide concurrency/resource-safety). (source: ecosystem-05 → OPINION O-03, TOOL-MATRIX)
- **5.2 Convert throwing code at the boundary.** `Result.fromThrowable(fn, errFn)` (sync) / `ResultAsync.fromPromise(p, errFn)` (async) — **always pass the second `errFn`** to map the unknown throw to a known error type. This satisfies "no try-catch-swallow." (source: ecosystem-05)
- **5.3 The sync-throw-in-a-promise gotcha.** A function can return a Promise yet throw synchronously (validation before `await`). `fromPromise` only catches rejections; use `fromThrowable` for non-`async` promise-returners. (source: ecosystem-05 → PITFALL P-07)
- **5.4 `safeTry` kills the andThen pyramid.** Generator form reads like sequential code, stays typed, short-circuits on first Err. Prefer it for multi-step flows; reserve `.andThen` chains for 1-2 step transforms. (source: ecosystem-05)
- **5.5 Enforce consumption.** `eslint-plugin-neverthrow` is **non-optional** — an unhandled Result silently drops the error (= the fire-and-forget the law bans). Rust's `#[must_use]` for Results. (source: ecosystem-05 → OPINION O-03, PITFALL P-08)
- **5.6 The full request lifecycle.** Zod parses at boundary → handler calls domain fns returning `ResultAsync<T, DomainError>` → handler `await`s + `.match`es → central `mapErrorToResponse(e)` is a discriminated union over the error type (adding a variant = compile error until mapped). Exhaustive, typed, non-throwing end to end. (source: ecosystem-05)

## JOB 6 — Stream output (SSE vs WebSocket)
*"Agent/LLM token output is one-way — SSE. Client-talks-back-mid-stream — WebSocket."*

- **6.1 SSE is the default for LLM/agent output.** OpenAI/Anthropic/Gemini ALL use SSE; HTTP/2 multiplexes streams over one TCP connection; infra "just works"; `EventSource` auto-reconnects + replays via `Last-Event-ID`. (source: ecosystem-08 → OPINION O-12)
- **6.2 WebSocket only for bidirectional.** Tool-use round-trips, interrupts (stop-generation), multi-agent routing, live collaboration. Industry is moving SOME LLM stacks to WS specifically for interrupts + tool-use. (source: ecosystem-08)
- **6.3 Hono streaming helpers** (`hono/streaming`, all Web-standard → identical on Node/Bun/Deno/Workers): `stream()` (binary), `streamText()` (text), `streamSSE()` (`writeSSE({data,event,id})`, `sleep`, `onAbort`). (source: ecosystem-08)
- **6.4 THE #1 production trap: nginx buffering.** Nginx batches responses by default → tokens arrive as one dump. Fix: header **`X-Accel-Buffering: no`** on streaming routes. (source: ecosystem-08 → PITFALL P-10, SCENARIO S-08, OPINION O-12)
- **6.5 THE Hono gotcha: `onError` does NOT fire once a stream starts** (headers already sent — can't turn 200 into 500). **MUST pass the 3rd-arg error handler** to `streamSSE`; handle errors inside the stream (write `event:error`, close). (source: ecosystem-08 → PITFALL P-11, SCENARIO S-08, OPINION O-12)
- **6.6 Stop on disconnect + resumability.** Loop `while (!stream.aborted)` so you stop burning LLM tokens when the client leaves; emit a monotonic `id` for `Last-Event-ID` resume; send `: ping` every ~15s to keep proxies from killing idle connections. (source: ecosystem-08 → OPINION O-12)

## JOB 7 — Make the surface contract-testable
*"Prove turbo's own routes honor their contract — cheapest layer first."*

- **7.1 'Schema valid' is weaker than 'compatible'.** Schema testing = legal shapes; contract testing = shapes AND behaviors a consumer *relies on*. (source: ecosystem-09)
- **7.2 Three layers, cheapest-first.** (1) **Compile-time:** the Hono RPC `typeof app` type IS a contract — a breaking server change is a compile error in TS clients (free, but only TS + only type drift). (2) **Runtime conformance:** assert real responses validate against the generated OpenAPI spec (the Zod parse already does this) + `oasdiff`/`openapi-diff` in CI to fail on breaking spec changes. (3) **Consumer-driven (Pact):** selective only, for high-value seams with many independent consumers relying on subsets/error-shapes the spec can't pin. (source: ecosystem-09 → OPINION O-08)
- **7.3 The boundary.** turbo owns the contract definition (OpenAPI-from-Zod + RPC type) + runtime-conformance + spec-diff for its own routes. Cross-service Pact brokering = fleet/test-infra, not turbo's. (source: ecosystem-09)

## JOB 8 — Stay alive at the serverless/edge state boundary
*"Cross-request state never lives in process. Two reasons now, not one."*

- **8.1 The `new Map()` law, upgraded.** Old reason: empty on cold start. **NEW reason (Vercel Fluid Compute, default-on 2026):** module state is **shared & racy across concurrent requests on one warm instance** — one instance handles dozens, peaking past 250 concurrent. (source: field-01, field-06 §4 → SCENARIO S-01, OPINION O-01, PITFALL P-02)
- **8.2 The canonical bug.** Module-scope mutable consumed by the handler → "category reports got items from other categories" (cross-user data bleed). The lazy-init `if (!cachedClient) cachedClient = createClient()` races under concurrency → N clients. (source: field-01 → SCENARIO S-01)
- **8.3 The taste that frames it.** *"This is not a Fluid Compute bug; it is a pre-existing code smell that isolation was hiding."* The platform got more honest, not more broken. (source: field-01 → OPINION O-01)
- **8.4 The audit recipe** (grep before shipping any Vercel route): module-scope mutables conditionally assigned in handlers; accumulating module arrays/objects; any `new Map()/Set()`/object-as-cache at module scope in `app/api/**`; raw lazily-assigned DB clients (use a pool — it's concurrency-safe; the lazy ref is not). **Never validate state behavior from local dev** — emulators don't reuse containers. (source: field-01 → SCENARIO S-01, PITFALL P-02)
- **8.5 At the edge it's worse.** Each Workers request can hit a different isolate on a different PoP → module state is globally non-deterministic. Cross-request state = Workers KV / Durable Objects / D1 / Upstash only. Heavy compute (image/large-JSON) does NOT belong in a 128MB/30-50ms-CPU Worker — push to Node/queue/DO/Sandbox. (source: ecosystem-07 → OPINION O-06)

## JOB 9 — Be agent-operable (the thing that makes turbo agent-NATIVE)
*"Every operation an agent must do — deploy, read logs, inspect contract, call/extend the API — has a deterministic, JSON-emitting, non-interactive path. And the service can itself speak MCP."*

- **9.1 Deterministic CLIs (always `--json`/`-j`).** `npm view <pkg> <field> --json` (version oracle for the RSI drift check); `wrangler dev/deploy/tail` + `d1 execute`/`kv put`/`secret put` (bindings MUST be in `wrangler.toml`); **`vercel logs -j`** (JSON Lines, agent-optimized) + `vercel discover --format=json`/`vercel guide` (autonomous integration install); `gh search/api`; `bun test`. (source: ecosystem-13 → TOOL-MATRIX)
- **9.2 turbo's own services can BE MCP servers.** `@hono/mcp`'s `StreamableHTTPTransport` turns a Hono app into a remote MCP server over Streamable HTTP (deployable to Workers, stateless). This satisfies the energy checklist's MCP component. Gotcha: accessing Hono `Context` inside a tool def is awkward — pass what the tool needs explicitly. (source: ecosystem-13 → PITFALL P-12)
- **9.3 MCP servers that TEACH the agent.** Attach `docs.mcp.cloudflare.com/mcp` when building on Workers (current API knowledge vs stale training data); `context7` for real package API surfaces (avoid hallucinated signatures). (source: ecosystem-13)
- **9.4 The agent-operability build checklist** (build these IN to every turbo service): structured JSON logging (Pino/`hono-pino`, NOT prose); `/openapi.json` + Scalar UI; `/health` (curl→200 deploy verify); typed errors → HTTP via `mapErrorToResponse`; `hcWithType` export; `@hono/mcp` endpoint when exposing tools; deterministic non-interactive `package.json` scripts; pinned deps + `npm view` drift check. (source: ecosystem-13 → OPINION O-13)

## JOB 10 — Migrate safely (when A→B is unavoidable)
*"Every good migration is a Strangler Fig, justified by correctness, not benchmarks."*

- **10.1 Never big-bang.** Wrap (`@fastify/express`-style) then strangle route-by-route; feature work keeps flowing. Val Town is the template: "the first fastify PR just wrapped the express server; each successive PR moved a few routes." (source: field-05 → SCENARIO S-07, OPINION O-14)
- **10.2 Dependency audit BEFORE you start.** The killer is a no-equivalent package (legacy payments) discovered mid-flight. List every middleware/plugin; confirm an equivalent exists. Express error-middleware has no 1:1 Fastify equivalent (→ `setErrorHandler`/hooks). (source: field-05 → SCENARIO S-07)
- **10.3 Migrate for correctness/DX/observability, NOT speed.** Every honest migration story says the framework wasn't the bottleneck. (source: field-05, field-02 → OPINION O-14)
- **10.4 The tRPC plot twist.** "People flee tRPC to REST" is FALSE in 2026 — nobody's fleeing; the move is to **oRPC** (1.6× type-check, native OpenAPI, edge) inside a layered REST-public/RPC-internal arch. Don't frame the choice as RPC-vs-REST. (source: field-05, field-06 §6 → GAPS, OPINION O-07)
- **10.5 A v4→v5 major bump is a migration, not a patch.** Express path-to-regexp v8 wildcard rename throws at boot — read the migration guide. (source: ecosystem-11, field-05 → SCENARIO S-03, PITFALL P-06)

---

## The Hono RPC discipline (cross-cutting — touches Jobs 2, 4, 7)
Hono's runtime is rock-solid; the fragility is the **RPC type system under real project structure**. An agent WILL break this. The five disciplines (all source: ecosystem-02, ecosystem-11):
1. Ship **`hcWithType`**, never raw `hc`, in any app >~20 routes (precompiles the client type → fast IDE). → PITFALL P-03
2. **Chain `.route()`** calls in one composition file (split files, chain in one place). → JOB 2.4
3. Monorepo/multi-package → **TS project references (`composite: true`)**, NOT `paths` aliases (maintainer admits no clean fix). → PITFALL P-03
4. RPC inference needs `c.json(x, 200)` with explicit status (not `c.notFound()`/bare returns) → discriminated union on `res.status`.
5. `"strict": true` BOTH sides; `$url()` needs absolute URLs; **pin identical `hono` versions** client+server (version skew → "excessively deep" + `#private` leak).

## The meta-lesson (the single most reusable taste)
**In 2026 every conventional-wisdom inversion is real but ASTERISKED — the platforms genuinely fixed things, but each fix MOVED the risk rather than deleting it:** type-stripping moved type-safety enforcement into CI (`tsc --noEmit`); Fluid moved state risk from cold-empty to warm-racy; edge moved the cold-start tax into runtime constraints; native-deps moved the line to stable-vs-experimental. **Adopt the inversion AND read the asterisk** — the bug just moved next door, usually into CI, concurrency, or the experimental column. (source: field-06 — this is the taste an over-eager agent will skip)

---

## Sibling artifacts (read these next)
- **BATTLE-TESTED-SCENARIOS.md** — ≥10 golden eval tasks (the failure/migration/prod scenarios, with resolution).
- **KNOWN-PITFALLS.md** — version-specific gotcha list, each with detection + avoidance.
- **OPINIONS.md** — the anti-slop taste layer ("always X / never Y — because Z").
- **GAPS-AND-DISPUTES.md** — where sources disagree (both sides) + what turbo must settle by experiment.
- **TOOL-MATRIX.md** — canonical tools, default-vs-alts, agent-access surface, required secrets.
