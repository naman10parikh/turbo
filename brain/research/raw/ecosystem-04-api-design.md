---
title: "API Design — REST vs RPC, OpenAPI-First, Versioning (June 2026)"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [api-design, rest, rpc, trpc, ts-rest, orpc, openapi, versioning]
sources:
  - "https://orpc.dev/docs/comparison (fetched 2026-06-11)"
  - "https://blog.logrocket.com/trpc-vs-orpc-type-safe-rpc/"
  - "https://www.pkgpulse.com/blog/orpc-vs-trpc-vs-hono-rpc-type-safe-apis-2026"
  - "WebSearch: REST versioning best practices 2026 (digitalapi.ai, speakeasy, Fern, redocly)"
summary: "RPC (typed, internal) vs REST+OpenAPI (contract, external). tRPC=TS-monorepo king but no native OpenAPI; ts-rest=contract-first REST; oRPC=hybrid w/ native OpenAPI+streaming+File. Versioning: URL-path for public, header for internal. OpenAPI-first prevents drift."
---

# The core axis: RPC vs REST (and why turbo needs both modes)

- **RPC (Remote Procedure Call)** = you call functions; types flow server→client with zero codegen
  (tRPC / Hono RPC / oRPC). Best when **the only consumer is your own TS frontend**. Friction-free, but the
  "API" is a TS type, not a spec — non-TS consumers, mobile, third parties, and Python services can't use it.
- **REST + OpenAPI** = you define resources + a spec; SDKs/docs are generated. Best when **external consumers,
  mobile, or non-TS clients** exist. More upfront definition, but the contract is language-neutral and durable.

**turbo is a backend/runtime domain-expert harness** — it will be asked to build both internal typed APIs and
public REST APIs. So the harness must know all four contenders and route by consumer.

## The 2026 contenders — honest routing table

| Tool | Model | OpenAPI | Native Date/File/Map | Best for | The catch |
|---|---|---|---|---|---|
| **tRPC v11** | procedure-first RPC | ❌ native (the old `trpc-openapi` is **deprecated + breaks on Edge**) | needs **SuperJSON** transformer | internal TS monorepo + React + TanStack Query | no spec → no non-TS consumers; OpenAPI is a pain |
| **Hono RPC (`hc`)** | route-type RPC over HTTP | via separate `@hono/zod-openapi` | Date→string only (issue #1800) | when you're already on Hono and consumer is TS | RPC type gotchas (see ecosystem-02) |
| **ts-rest** | **contract-first** REST | ✅ generates OpenAPI from contract | 🛑 weak on Date/File | REST + external consumers, strict contract | rigid; missing tRPC-style middleware/data-type ergonomics |
| **oRPC v1** | **hybrid** (procedure OR contract) | ✅ **first-class** OpenAPI for the same code | ✅ **native Date/URL/Set/Map** (no SuperJSON) | want one codebase serving both typed-TS client AND REST/OpenAPI for Python/mobile/3rd-party | newest of the four; smaller battle history |

### oRPC's own claimed deltas (source: orpc.dev/docs/comparison, fetched 2026-06-11)
oRPC marks itself ✅ where competitors are 🟡/🛑 on: **end-to-end typesafe File/Blob** (tRPC 🟡, ts-rest/Hono 🛑),
**end-to-end typesafe streaming** (ts-rest/Hono 🛑), **OpenAPI for multiple schemas** (tRPC/ts-rest 🛑),
**native types Date/URL/Set/Map** (others 🟡/🛑), **contract-first AND procedure-first** (tRPC 🛑 on
contract-first), and Cloudflare **WebSocket Hibernation** + **MessagePort** (others 🛑). Treat as the vendor's
own claims — but the structural point (one definition → both RPC client AND OpenAPI REST) is real and is the
reason oRPC is the most interesting 2026 entrant.

**turbo verdict:**
- Consumer = our own TS app only → **Hono RPC** (we're on Hono anyway) or **tRPC** (if heavy TanStack Query).
- Consumer = external / mobile / non-TS / needs a spec → **oRPC** (preferred — one codebase, native types,
  real OpenAPI) or **ts-rest** (if you want strict contract-first and oRPC feels too new).
- Pure REST with no RPC client wanted → Hono routes + **`@hono/zod-openapi`** (Zod schemas → OpenAPI), or
  generate the spec from Zod via `z.toJSONSchema()`.

---

# OpenAPI-FIRST — the load-bearing flow (prevents drift)

The whole point: **the OpenAPI document is the single source of truth**; implementation, docs, and client SDKs
are generated from it, so they can't drift. (Source: Fern / Speakeasy / redocly, 2026.)

Two viable mechanics in a TS+Zod stack:
1. **Schema-first-in-code → spec-out:** write Zod schemas, derive OpenAPI via `@hono/zod-openapi` (the
   `createRoute` + `OpenAPIHono` API; reached **v1.0**, `@hono/zod-openapi@1.4.0`) or `z.toJSONSchema()` +
   `@asteasolutions/zod-to-openapi@8.5.0`. The Zod schema validates at runtime AND emits the contract. This is
   the **least-drift** option because the validator and the spec are the same object.
2. **Spec-first → code-out:** hand-author `openapi.yaml`, generate types/handlers (e.g. `openapi-typescript`,
   `@hey-api/openapi-ts`, or ts-rest's contract). Better for big orgs / external-API-first teams.

**turbo default: option 1 (Zod → OpenAPI via `@hono/zod-openapi`).** One schema = runtime validation +
published contract + typed client. Matches the energy law ("Zod at every boundary") with zero extra source of
truth. Serve the generated spec at `/openapi.json` + a Scalar/Swagger UI route.

---

# Versioning — what's actually correct in 2026

No universal winner; route by audience (source: digitalapi.ai, ASOasis 2026-04, Speakeasy, Microsoft Azure
API guide):

| Strategy | Example | Pros | Cons | Use when |
|---|---|---|---|---|
| **URL path** | `/v1/users` | obvious, browser/cache-friendly, trivial to test | URI changes per version (violates HATEOAS purism) | **public APIs / wide dev audience** (default) |
| **Header** | `Accept: application/vnd.github.v3+json` (GitHub) | stable resource URI, RESTful-pure | invisible, harder to test/explore | **internal microservices**, content negotiation |
| **Media type** | `application/vnd.api.v2+json` | per-resource granularity, small code footprint | least accessible, hardest to curl | granular per-resource evolution |
| **Query param** | `/users?version=2` | easy | pollutes caching, easy to forget | quick/legacy, avoid for new |

**turbo stance:** **URL-path versioning (`/v1`) for any externally-consumed API** (it's the de-facto standard,
easiest for agents AND humans to test with curl). **Header versioning for internal service-to-service.** Keep a
**single evolving OpenAPI doc** and add endpoints; cut a **separate spec file per MAJOR version** only on a
breaking change. Never break a `/vN` in place — additive changes only within a major; breaking change ⇒ `/vN+1`.

> Boundary note: turbo owns the API *shape* + validation + versioning. **Rate-limiting and response caching
> belong to Wave-2 echo.** The handoff seam: turbo defines the route + the cache-control/ETag *semantics* in the
> OpenAPI contract; echo implements the cache store + rate-limit middleware behind it. turbo MUST NOT use
> `new Map()` for any cross-request counter/cache (energy law) — that's echo's external-store territory.
