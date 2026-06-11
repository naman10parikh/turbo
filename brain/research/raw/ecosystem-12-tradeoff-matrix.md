---
title: "Competing-Tools Honest Trade-off Matrix — Backend/Runtime (June 2026)"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [tradeoffs, matrix, frameworks, validation, rpc, runtime, result]
sources: ["consolidated from ecosystem-02 through ecosystem-11 (this corpus)"]
summary: "The decisive trade-off tables across every axis turbo decides on: framework, validation, API/RPC, Result lib, runtime, edge host. With explicit 'turbo picks' and the one-line reason each."
---

# How to use this
Each table = one decision turbo's PLAN/build waves will make. The **bold row = turbo default**; the "pick the
other when" column is the honest escape hatch. All claims trace to ecosystem-01…11 in this corpus.

## 1. HTTP framework
| Framework | Wins | Loses | Pick when |
|---|---|---|---|
| **Hono 4.12** ✅ | runs on Node+Bun+Deno+Workers unmodified (Web-Fetch); fast RegExpRouter; first-party typed RPC; edge-native | RPC type gotchas; middleware security surface needs patch-pinning; newer | **default** — edge + multi-runtime + typed RPC = the harness mandate |
| Fastify 5.8 | most mature Node plugin ecosystem; JSON-Schema-native (Ajv); battle-proven at scale | Node-only (no edge without adapters); no typed client | long-running **Node-only** service needing deepest plugins / JSON-Schema |
| Express 5.2 | ubiquitous, every middleware exists; v5 fixed async error forwarding | slowest; Node-only; path-to-regexp v8 wildcard break; ecosystem drift | legacy interop, or a middleware that exists ONLY here |
| NestJS | structure/DI for big teams; enterprise patterns | heavy; opinionated; overkill for a service | large team wanting Angular-style architecture (rarely turbo's call) |

## 2. Validation (the "Zod at every boundary" law)
| Lib | Wins | Loses | Pick when |
|---|---|---|---|
| **Zod 4.4** ✅ | best ecosystem/docs; `z.toJSONSchema()` → OpenAPI; now 14x faster + 2.3x smaller than v3; Standard Schema | `.default()`-on-PATCH data-loss trap; `z.coerce` input=unknown break; UUID stricter | **default** — bind via Standard-Schema middleware so it's swappable |
| Valibot 1.4 | smallest bundle (sub-2kb tree-shaken); modular; Standard Schema | worse DX for complex schemas | **bundle size is the binding constraint** (edge/Workers) |
| ArkType 2.2 | TS-syntax-as-schema; top runtime perf; Standard Schema | smaller ecosystem; steeper concepts | want types defined in TS syntax + max perf |
| (Ajv/JSON-Schema) | native to Fastify; spec-standard | not TS-type-first; verbose | you're on Fastify and want its native path |

## 3. API contract / RPC style
| Tool | Model | OpenAPI | Rich types (Date/File) | Pick when |
|---|---|---|---|---|
| **Hono RPC (`hc`)** ✅ | route-type RPC | via `@hono/zod-openapi` v1.0 | Date→string only | on Hono + TS-only consumer (default for internal) |
| **oRPC v1** ✅ | hybrid (proc OR contract) | **first-class, multi-schema** | **native Date/URL/Set/Map** | external/non-TS consumers + rich types (default for public) |
| tRPC v11 | procedure RPC | ❌ (old plugin deprecated, breaks on Edge) | needs SuperJSON | TS monorepo + heavy TanStack Query |
| ts-rest 3.52 | contract-first REST | ✅ generated | weak Date/File | strict contract-first REST, oRPC feels too new |

## 4. Error handling (the "Result<T,E>, no try-catch-swallow" law)
| Approach | Wins | Loses | Pick when |
|---|---|---|---|
| **neverthrow 8.2** ✅ | explicit typed Result; no paradigm shift; per-function value; eslint-plugin enforces consumption; `safeTry` | manual; you wrap throwers via `fromThrowable`/`fromPromise` | **default** — satisfies the law with least ceremony |
| Effect 3.21 | typed errors in signature; DI; structured concurrency; retries/interruption | whole paradigm; overkill unless system-wide | genuinely Effect-shaped work (complex concurrency/resource-safety) |
| try-catch | trivial | swallows errors; untyped; banned as default by the law | ONLY at the boundary to wrap a thrower, or truly-fatal crashes |

## 5. Runtime
| Runtime | Cold start | Node compat | Pick when |
|---|---|---|---|
| **Node 22/24 LTS** ✅ | slowest of 3 | 100% | **default for the core service** — most stable, widest compat; runtime isn't your bottleneck |
| **Bun 1.3** ✅ (selective) | fast (8–15ms class) | ~95–98% | CLIs, edge, build scripts, **`bun test`**; NOT DB-bound services (perf edge → ~3%); audit native addons first |
| Deno 2.x | fast | npm-compatible now | want permission model / Deno Deploy / native TS+security |

> Node 20 hit **EOL 2026-04-30** — do NOT target Node 20 despite the checklist's "20+". Floor = **22**, default = **24**.

## 6. Edge host (deploy seam — not turbo-owned, but turbo must run on it)
| Host | Cold start | Model | Pick when |
|---|---|---|---|
| **Cloudflare Workers** | <5ms | V8 isolate, Web-API subset (`nodejs_compat`), 128MB/30-50ms CPU, 330+ PoPs, Durable Objects/Sandboxes GA | global/spiky traffic, edge state via DO/KV |
| **Vercel (Node fn)** ✅ | 200-800ms | full Node Lambda | energy default host; heavy/stateful single-region work |
| **Vercel (Edge fn)** | 50-250ms | V8 isolate | being de-emphasized vs Workers; middle ground |
| Fly.io | n/a | long-running Node containers | persistent services/WebSockets at length |

---

# turbo's "default stack" in one line (the synthesis)
**Hono 4.12 (≥.25) on Node 24 LTS · Zod 4.4 at every boundary (Standard-Schema-bound, swappable) · OpenAPI-first
via `@hono/zod-openapi` 1.0 (or oRPC for external rich-type APIs) · neverthrow 8.2 Result everywhere
(+eslint-plugin) · `hcWithType` not raw `hc` · TS project references for monorepo RPC · SSE for streaming · Bun
for CLIs/tests · ship to Vercel-Node, promote latency-critical routes to Workers.** Rate-limit/cache = echo's
seam (external store, never `new Map()`).
