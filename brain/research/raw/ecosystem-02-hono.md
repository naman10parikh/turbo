---
title: "Hono v4 Deep Dive — Where It Beats Express/Fastify, and Where It Bites (June 2026)"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [hono, express, fastify, router, rpc, runtime, benchmarks]
sources:
  - "https://hono.dev/docs/guides/rpc (fetched 2026-06-11)"
  - "https://hono.dev/docs/concepts/benchmarks (fetched 2026-06-11)"
  - "github.com/honojs/hono issues #1746 #2672 #1695 #1800 #2955 #3148"
  - "npm view hono / fastify / express (2026-06-11)"
summary: "Hono 4.12.25 is the de-facto edge/multi-runtime TS framework; tiny+fast core, but the RPC type system and middleware surface are the real footguns."
---

# Hono v4 — The Domain-Expert View (turbo's default framework)

**Latest: hono@4.12.25 (2026-06-09). 30,905★. Runtime-agnostic** — same code runs on Cloudflare Workers,
Deno, Bun, Node (via `@hono/node-server@2.0.4`), Vercel, AWS Lambda, Lambda@Edge, Fastly. This multi-runtime
property is the #1 reason the energy checklist calls it "de-facto for Cloudflare Workers" and why turbo
(a backend/runtime harness that must target both Node AND edge) should default to it.

## Why Hono beats Express/Fastify (the honest list)

1. **Web-standard primitives.** Hono is built on the **Fetch API** (`Request`/`Response`), not Node's
   `http.IncomingMessage`. This is why it runs unmodified on edge runtimes. Express/Fastify are Node-`http`-bound
   and need shims/adapters for edge. For a harness that must deploy to Cloudflare Workers AND Vercel Node
   functions, this is decisive.
2. **Speed.** On Cloudflare Workers: **402,820 ops/sec** (Hono) vs itty-router 212,598, sunder 297,036
   (source: hono.dev/docs/concepts/benchmarks). On Deno: **136,112 req/sec** (Hono) vs Fast 103k, oak 43k.
   The **RegExpRouter** is the differentiator — it compiles all routes into a single large regex, giving O(1)-ish
   matching regardless of route count (vs trie/linear scan). `SmartRouter` auto-picks RegExpRouter when possible
   and falls back to TrieRouter for patterns RegExpRouter can't express.
3. **Tiny.** Core preset is a few KB; tree-shakeable middleware. Matters for edge cold-start and bundle limits.
4. **First-party RPC** — `hc<AppType>()` gives end-to-end type safety from server route → client call without
   codegen (tRPC-like, but over plain HTTP/REST). Express has nothing here; Fastify has type-providers but not
   a client.
5. **Batteries via `@hono/*`** — zod-validator, zod-openapi (now v1.0), JWT, CORS, compress, cache,
   serve-static, WebSocket helpers, MCP helper. All opt-in.

## Benchmark caveat (taste)
Hono's own page says "Benchmarks are only benchmarks." Real apps are dominated by DB/IO, not router overhead.
Hono's win is **portability + edge-readiness**, not raw throughput you'll ever notice in a CRUD app. Pick Hono
for "runs everywhere + typed RPC," not because it shaves microseconds off routing.

---

# THE LOAD-BEARING FLOW: Hono RPC type-safety (and its 5 documented gotchas)

This is the flow an agent WILL break. Source: https://hono.dev/docs/guides/rpc (fetched 2026-06-11).

**The happy path:**
```ts
// server: chain routes, export the type
const routes = app.route('/authors', authors).route('/books', books)
export type AppType = typeof routes
// client:
const client = hc<AppType>('http://localhost:8787')
const res = await client.authors.$get()   // fully typed input + output
```

### Gotcha 1 — IDE/tsserver melts on large apps ("Compile your code before using it")
Massive type instantiations slow tsserver as routes grow. **Official fix** — pre-compile the client type so the
calc happens once at build, not on every keystroke:
```ts
export type Client = ReturnType<typeof hc<typeof app>>
export const hcWithType = (...args: Parameters<typeof hc>): Client => hc<typeof app>(...args)
```
"This will make your IDE a lot faster!" — use `hcWithType`, never raw `hc`, in any app with >~20 routes.
**turbo rule: every Hono service ships a `hcWithType` export, not a raw `hc`.**

### Gotcha 2 — You MUST chain `.route()` calls
Splitting routes into separate files WITHOUT chaining breaks inference. Must be
`app.route('/a', a).route('/b', b)`. This conflicts with "files < 400 lines" — resolve by defining sub-apps in
separate files but **chaining them in one composition file** that exports `AppType`.

### Gotcha 3 — Monorepo / version mismatch → "Type instantiation is excessively deep and possibly infinite"
If backend and frontend live in different dirs, **the `hono` versions MUST match exactly**. Mismatch produces
the infamous "excessively deep" error. Fix: TS project references (`composite: true` + `references`) or
Turborepo. (Confirmed in the wild by issue #1746 — see below.)

### Gotcha 4 — `c.json()` with explicit status, not `c.notFound()`
RPC inference only works for handlers returning `c.json(...)` (ideally with explicit status codes). `c.notFound()`
and bare returns aren't inferred. Status-code-typed responses (`c.json(x, 200)`) give the client discriminated
unions on `res.status`.

### Gotcha 5 — `strict: true` required both sides; `$url()` needs absolute URLs
RPC types require `"strict": true` in BOTH client and server tsconfig (aligns with energy's no-`any` law).
`$url()` does not work with relative URLs.

## Real-world confirmation — issue #1746 (CLOSED): "Absolute imports break `typeof app` for rpc client"
- Repro: a route imported via a **path alias / absolute import** (e.g. `import { route } from 'test-route'`)
  loses its type; the same import **relative** (`./test-route`) works.
- Spread beyond original: reporters confirmed it also breaks with **path aliases** (Holmes-EH, v4.0.10) and in
  **monorepos** where the API moved to its own package (auvansang).
- **Maintainer yusukebe (verbatim):** _"I am not ignoring the issue because I don't see a good solution. If anyone
  knows of a better way, please let me know."_ → i.e. this is an unsolved structural limitation of TS inference,
  not a Hono bug they'll patch.
- **The working fix (GabrielHangor, verbatim):** _"it was related to tsconfig in my monorepo... I had to enable
  `composite: true` in the server subrepo and add path reference in the client pointing to tsconfig in the server."_
- **turbo takeaway:** in any monorepo/multi-package layout, use TS **project references** (`composite: true`)
  for the server package and reference it from the client. Do NOT rely on `paths` aliases for the app type.

---

# Other real Hono breakage (closed issues, ranked by engagement)

- **#2672 (47 comments) "Router does not decode URIs"** — URL-encoded path segments weren't decoded; a
  long-running semantics debate (decode-once vs raw). Affects anyone with `:param` containing `%2F`/encoded
  chars. Know the current decode behavior before routing on encoded params.
- **#1695 (44 comments) "TypeError: Response body object should not be disturbed or locked"** — the
  **streaming/Response-reuse footgun**: a `Response` body is a one-shot stream; reading it twice (or returning
  an already-consumed Response, common in middleware that inspects the body) throws. Directly relevant to
  turbo's streaming/SSE work — see ecosystem-08-streaming.md.
- **#1800 (29 comments) "JSON response can't contain Dates"** — `c.json()` serializes `Date` to string, so the
  **RPC client infers `string`, not `Date`** (a type/runtime gap). Pattern: serialize dates to ISO strings
  explicitly and parse on the client; don't expect `Date` round-trips. (This is the JS JSON reality, surfaced
  sharply by typed RPC.)
- **#2955 (29 comments) "Weird `#private` property in some classes"** — TS `#private` fields on Hono classes
  leak into inferred types and break structural matching across version/copy boundaries (related to the
  version-mismatch RPC error).
- **#3148 "'client' is of type 'unknown' when using route"** — another inference-loss variant; same family as #1746.
- **#1127 "__STATIC_CONTENT_MANIFEST error when bundling with wrangler"** — Cloudflare-specific static-assets
  bundling break; relevant when deploying serve-static to Workers.

**Pattern across all of these:** Hono's runtime is rock-solid and fast; the **fragility is in (a) the RPC type
system under real project structures and (b) the middleware surface** (see the v4.12 security wave in
ecosystem-01). An agent operating Hono needs to internalize the RPC tsconfig discipline and pin latest patches.

---

# Hono vs Express vs Fastify — when to pick which (turbo's stance)

| Dimension | **Hono 4.12** | **Fastify 5.8** | **Express 5.2** |
|---|---|---|---|
| Primitive | Web Fetch (`Request`/`Response`) | Node `http` | Node `http` |
| Runs on edge (CF/Deno/Bun) unmodified | ✅ yes (its whole point) | ⚠️ adapters only | ⚠️ adapters only |
| Throughput | very high (RegExpRouter) | very high (find-my-way) | moderate (slowest of 3) |
| Typed end-to-end RPC client | ✅ `hc` (with gotchas) | ❌ (type-providers only) | ❌ |
| Schema validation story | `@hono/zod-validator` / Standard Schema | JSON-Schema native (Ajv) + type-providers | none built-in (BYO middleware) |
| OpenAPI-first | `@hono/zod-openapi` v1.0 | `@fastify/swagger` (mature) | external |
| Plugin ecosystem maturity | growing | **largest/most mature** for Node servers | largest legacy, but unmaintained drift |
| Async error handling | native (Fetch handlers) | native (`setErrorHandler`) | **NEW in v5**: promise rejections auto-forwarded |
| Maturity / battle-tested at scale | newer, edge-native | very mature, prod-proven | most ubiquitous, oldest |

**turbo verdict:** default **Hono** (edge + typed RPC + multi-runtime = matches the harness mandate to deploy to
Vercel AND Cloudflare). Use **Fastify** when the target is a long-running Node-only service that needs the
deepest plugin ecosystem and JSON-Schema-native validation (and you don't need edge). Use **Express 5** only for
legacy interop or when a required middleware exists only there — and note Express 5 finally fixed async error
forwarding (no more `next(err)` boilerplate for promise rejections). Never use Express 4 for new code.

> Express-5-specific gotcha (for migration stories): the `path-to-regexp` upgrade changed wildcard syntax —
> bare `*` must become a **named** wildcard (`/*splat`), and unnamed regex groups in routes throw at boot. This
> is the #1 break when upgrading Express 4→5. (See ecosystem-12 trade-off matrix.)
