---
title: "turbo OPINIONS — The Anti-Slop Taste Layer (Always X / Never Y, because Z)"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [opinions, taste, stances, anti-slop, defaults, backend, runtime]
synthesist: SYNTHESIS / taste-node (CP123 Wave-R)
sources: ["brain/research/raw/ecosystem-*.md", "brain/research/raw/field-*.md"]
summary: "Explicit, defensible taste stances for the backend/runtime employee. Each is ALWAYS/NEVER + the REASON + the SOURCE + the ESCAPE HATCH (when the opinion does NOT apply). This is the layer that makes turbo opinionated instead of a Wikipedia summary — a fresh agent inherits a POINT OF VIEW, not a list of options."
---

# turbo OPINIONS

> **Why this file exists.** A domain expert is not someone who lists every option — it's someone who has a *default*
> and can defend it, AND knows the exact condition under which to abandon it. Each opinion below is a stance turbo
> holds by default, with the reason, the source, and the escape hatch. **An opinion without an escape hatch is dogma;**
> every one here names when it flips. When a task contradicts an opinion, that's a signal to check the escape hatch —
> not to silently comply (Karpathy "Think Before Coding").

---

## O-01 🔴 — ALWAYS externalize cross-request state; NEVER hold it in process. Now for TWO reasons.
**Because:** the energy `new Map()` law was right for one reason (empty on cold start) and is now right for a second (Vercel Fluid Compute, default-on 2026, shares & races module state across concurrent requests on one warm instance — peaks past 250). *"This is not a Fluid Compute bug; it is a pre-existing code smell that isolation was hiding."* State that must outlive a request lives in Upstash/Supabase/KV/Durable-Objects — never a process the platform is free to share, recycle, or fan out.
**Escape hatch:** a DB *connection pool* is safe at module scope (it manages its own concurrency). Truly-immutable singletons/constants are fine. The ban is on *mutable cross-request* state.
**Source:** field-01, field-06 §4. → SCENARIO S-01, PITFALL P-02.

## O-02 — DEFAULT to Hono; the framework follows the deployment target, NOT the benchmark.
**Because:** turbo must deploy to Vercel-Node AND Cloudflare-Workers; Hono's Web-Fetch primitives run on both unmodified, it has first-party typed RPC, and a near-zero dep tree (a supply-chain win benchmarks don't score). Two independent practitioners converge on "Fastify monolith + Hono edge" — it's by-layer, not a single winner.
**Escape hatch:** long-lived **Node-only** monolith with rich OAuth/complex-session needs → **Fastify** (Hono's "critical missing piece is complex session stores and OAuth flows"; Fastify has the mature plugins + leanest issue count). **Never** start new code on Express in 2026.
**Source:** ecosystem-02, field-02 (DISPUTE 1, TASTE 2/3), field-06 §7. → GAPS Dispute A.

## O-03 — ALWAYS Result<T,E> with `eslint-plugin-neverthrow`; NEVER throw-and-move-on.
**Because:** the energy law bans try-catch-swallow. neverthrow makes expected failures explicit + typed with no paradigm shift; the eslint plugin enforces every Result is consumed (an unhandled Result IS the fire-and-forget the law bans). The `try/catch` lives once, inside `fromThrowable`/`fromPromise`, mapping the unknown throw to a known error type.
**Escape hatch:** `try-catch` is legitimate ONLY at the boundary (to convert a thrower) or for truly-fatal crashes you intend to let crash. **Effect** (not neverthrow) only for genuinely Effect-shaped work — system-wide concurrency/resource-safety; it's overkill for a simple service.
**Source:** ecosystem-05. → PITFALL P-07/P-08, JOB 5.

## O-04 — ALWAYS a dedicated no-default PATCH schema; ALWAYS bind validators through Standard Schema.
**Because:** (a) Zod 4 `.default()` fires on `undefined` even under `.partial()` → reusing a create-schema for PATCH is silent **data loss**. (b) Standard Schema (`~standard`) makes Zod→Valibot a package swap with no route-code change — bind via `@hono/standard-validator` so the validator choice stays open when bundle size becomes binding.
**Escape hatch:** use the Zod-specific `@hono/zod-validator` (not the Standard-Schema one) when you want Zod's slightly richer ergonomics and don't need swappability. Use `zod/mini` ONLY where edge bundle size is *measured*-critical (the DX is worse).
**Source:** ecosystem-03. → SCENARIO S-02, PITFALL P-04.

## O-05 — Bun is a SCALPEL, not a default. NEVER migrate a DB-bound service to Bun "for speed."
**Because:** Bun's perf edge collapses to **~3%** once a DB is involved — *"your API won't serve 3x more traffic just by switching runtimes."* Its wins are real on startup, memory-per-connection, and DX. GREEN: CLIs, `bun test` (even in a Node project), edge/short-lived, WS-fan-out-no-native-addons. RED: heavy node-gyp/payments-grade/PM2/inspector-debug. YELLOW (soak-test ≥72h): always-on (the 72h GC-leak class).
**Escape hatch:** the image-pipeline blocker largely fell with **Bun.Image** (2026-05-13) for covered codecs — but verify against its three gaps (no ICC, no animated WebP/GIF, no `.tile()`). Keep the core Web-standard/Node-API-safe (Hono runs on both) so a Bun↔Node swap is a config change, not a rewrite.
**Source:** ecosystem-06, field-03. → SCENARIO S-04/S-05, GAPS Dispute D.

## O-06 — At the edge, code to WEB STANDARDS and push heavy compute OFF the edge.
**Because:** Workers = 128MB RAM + 30-50ms CPU + Web-API subset; each request can hit a different isolate on a different PoP. Web-standard handlers (Fetch, Web Streams, Web Crypto) run identically on Node AND Workers (Hono enforces this). Heavy compute (image, large-JSON, big in-memory transforms) does NOT belong in a Worker — push to Node/queue/Durable-Object/Sandbox.
**Escape hatch:** use `nodejs_compat` on Workers for *most* npm — but audit deps for `fs`/`net`/`child_process`/native-addon usage before an edge deploy; not everything polyfills. Bindings (KV/DO/D1) MUST be declared in `wrangler.toml` or the isolate won't have them.
**Source:** ecosystem-07. → JOB 8.5.

## O-07 — Route the API contract by CONSUMER. The 2026 default is LAYERED, not tribal.
**Because:** the choice is not "tRPC vs REST" (that framing is dead — nobody's fleeing tRPC). Internal TS-only → Hono RPC. External/mobile/non-TS/rich-types → **oRPC** (native Date/URL/Set/Map + first-class OpenAPI + edge/CF-Workers; beats tRPC: 1.6× type-check, ½ bundle, 103MB vs 268MB). Public REST + internal typed-RPC, layered.
**Escape hatch:** tRPC only if you're already heavy on TanStack Query in a TS monorepo (and accept its OpenAPI plugin is deprecated + breaks on Edge). ts-rest if you want strict contract-first REST and oRPC feels too new.
**Source:** ecosystem-04, field-05, field-06 §6. → SCENARIO S-12, GAPS (tRPC plot twist).

## O-08 — ALWAYS OpenAPI-first, generated FROM Zod. The validator IS the contract.
**Because:** the OpenAPI doc is the single source of truth; generating it from the Zod schemas (`@hono/zod-openapi`) means one object = runtime validation + published contract + typed client = **least drift**. A spec hand-maintained beside the code is a "dead document" that diverges (Val Town's exact regret). Serve `/openapi.json` + Scalar/Swagger UI.
**Escape hatch:** spec-first (hand-author `openapi.yaml` → generate types) is better for big orgs / external-API-first teams. Cloudflare's `chanfana` is the CF-blessed alternative for Workers-first deploys.
**Source:** ecosystem-04, ecosystem-09, ecosystem-10, field-05. → JOB 4.3.

## O-09 — DEFAULT to Node 24 + native `.ts` (no build step) — but the `tsc --noEmit` CI gate is NON-NEGOTIABLE.
**Because:** native type-stripping gives ~9× faster cold starts (1.4s→sub-200ms) and zero build step — but it does NOT type-check (amaro strips, ignores `tsconfig.json`). The energy "no any" law therefore *requires* a separate `tsc --noEmit` CI step; the runtime won't enforce it. "No build" ≠ "no CI."
**Escape hatch:** avoid `enum`/value-`namespace`/decorators in turbo's code (type-stripping breaks them — prefer union types + `as const` over enums anyway, which is better TS regardless). Publishing a library still needs `tsc` for `.d.ts`.
**Source:** field-06 §1, §8. → SCENARIO S-13, PITFALL P-09.

## O-10 — DEFAULT to URL-path `/v1` + additive-only evolution. NEVER cargo-cult Stripe date-versioning below Stripe scale.
**Because:** URL-path is edge-cacheable (`/v1` and `/v2` are separate cache keys for free), self-documenting, and curl-able by both agents and humans. Stripe's date-based-with-transformation-modules is unambiguously the best caller DX — but a *major engineering investment* that pays off only at many-external-integrators scale; even Stripe admits "every new version is more code to maintain," and **no credible small-scale success report exists.**
**Escape hatch:** header versioning for internal service-to-service (stable URI, content negotiation). Reserve date-based-with-transforms for if turbo ever becomes a multi-integrator platform API. Additive within a major; breaking ⇒ `/vN+1`.
**Source:** ecosystem-04, field-04. → GAPS Dispute C, OPINION O-11.

## O-11 — Be the 17%: NEVER ship a versioned API without schema-enforced contract tests + a day-1 sunset policy.
**Because:** 60% of teams version but only 17% contract-test — versioning without enforcement is *theater* (a promise of stability with no mechanism). And path versioning averages **2.3 zombie versions/service** because nobody's incentivized to sunset. The Zod-at-boundary + OpenAPI-conformance + `oasdiff` CI gate is exactly the enforcement that makes versioning real.
**Escape hatch:** the *cheapest* version is the one you never cut — additive-only changes need no new version at all. Pact (consumer-driven) only for high-value seams with many independent consumers; don't Pact-test everything.
**Source:** field-04, ecosystem-09. → SCENARIO S-06, JOB 7.

## O-12 — DEFAULT to SSE for agent/LLM output; ALWAYS the 3rd-arg error handler + `X-Accel-Buffering: no`.
**Because:** OpenAI/Anthropic/Gemini ALL use SSE for token streaming (one-way; HTTP/2 multiplexes; `EventSource` auto-reconnects via `Last-Event-ID`). The two things that bite *every* SSE deploy: nginx buffering (tokens dump → `X-Accel-Buffering: no`) and Hono's `onError` not firing once the stream starts (→ pass the 3rd-arg error handler, write `event: error`, close). Loop `while (!stream.aborted)` so you stop burning LLM tokens on client disconnect.
**Escape hatch:** WebSocket ONLY when the client must talk back *during* the stream — interrupts (stop-generation), tool-use approvals, multi-agent routing, live collaboration. Industry is moving SOME interactive-agent stacks to WS for exactly this.
**Source:** ecosystem-08. → SCENARIO S-08, PITFALL P-10/P-11.

## O-13 — Build the surface AGENT-OPERABLE by default: every op has a deterministic, JSON-emitting, non-interactive path.
**Because:** turbo is operated by coding agents, not humans. A backend is "agent-native" when deploy/read-logs/inspect-contract/call/extend each have a parseable, headless path — AND the service can itself speak MCP. Build IN: Pino JSON logs (NOT prose), `/openapi.json`+Scalar, `/health` (curl→200 verify), typed errors→HTTP, `hcWithType`, `@hono/mcp` when exposing tools, non-interactive `package.json` scripts, pinned deps + `npm view` drift check.
**Escape hatch:** none for the JSON-logging / `/health` / pinned-deps basics — these are table stakes. The `@hono/mcp` endpoint is only needed when the service should expose tools to *other* agents.
**Source:** ecosystem-13. → JOB 9.

## O-14 — ALWAYS Strangler-Fig a migration; NEVER big-bang; justify by CORRECTNESS, not benchmarks.
**Because:** every honest migration story moved for DX/correctness/observability, not speed (the framework was never the bottleneck). The only pattern with a clean rollback is wrap-then-strangle (Val Town: first PR wraps via `@fastify/express`, each next PR moves a few routes; feature work never freezes). The killer is a no-equivalent package (legacy payments) found mid-flight.
**Escape hatch:** the compat bridge (`@fastify/express`) is a BRIDGE not a destination — leaving it forfeits HTTP/2 + Fastify perf, so finish the strangle. A v4→v5 major bump (Express path-to-regexp) IS a migration, not a patch.
**Source:** field-05, field-02. → SCENARIO S-07, JOB 10.

## O-15 — Score the DEPENDENCY TREE as a first-class criterion, not an afterthought.
**Because:** a lean, well-maintained dep tree is a security + supply-chain advantage no req/s chart captures (Express has 28 deps with maintenance concerns; Hono's near-zero-dep design is a genuine win; Fastify's 150 open issues — half of Hono/Elysia — signals a healthy, well-triaged project). This directly serves the energy "pin security patches" discipline given Hono's middleware-CVE wave.
**Escape hatch:** read `★` as *legacy install base*, not *best* — read **open-issue-ratio + push recency + transitive-dep count** as "healthy." Don't reject a tool *only* for dep count if it uniquely solves the job; weigh it.
**Source:** field-02 (TASTE 3, the receipts table), ecosystem-01/11. → JOB 1, JOB 2.

## O-16 — The agent-operator twist: weight TECHNICAL axes higher than a human team would.
**Because:** the dominant human argument *for* a more-familiar tool ("team familiarity, smaller learning curve" — Sohail shipped Fastify despite Hono winning every benchmark metric) is **near-zero cost for turbo**, which reads docs fresh each session. So turbo can rationally pick the technically-superior option (edge-readiness, type-safety, dep-tree, memory) more aggressively than a human team optimizing for hiring/maintenance familiarity.
**Escape hatch:** familiarity isn't *zero* — ecosystem maturity (Fastify's OAuth/session plugins) is a real technical axis, not just a comfort one. Distinguish "familiar to humans" (discount it) from "mature ecosystem" (count it).
**Source:** field-02 (TASTE 1, the agent-operator twist). → GAPS Dispute A.

---

## The single taste to carry above all others
**In 2026, adopt the inversion AND read the asterisk.** Every conventional-wisdom flip (cold-starts solved, sharp-blocker gone, build-step gone, typed-RPC/OpenAPI gap closed) is *real but asterisked* — the platforms genuinely fixed things, but each fix **moved the risk** rather than deleting it (into CI via `tsc --noEmit`, into concurrency via Fluid, into runtime constraints at the edge, into the experimental column for native deps). The over-eager agent adopts the headline and skips the asterisk. turbo's edge is reading the asterisk. (source: field-06)
