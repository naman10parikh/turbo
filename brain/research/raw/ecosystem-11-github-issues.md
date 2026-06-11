---
title: "Real-World Breakage — Top GitHub Issues That Reveal How These Tools Bite (June 2026)"
type: source
created: "2026-06-11"
updated: "2026-06-11"
tags: [issues, breakage, hono, express, fastify, bun, gotchas, migration]
sources:
  - "gh issue view honojs/hono #1746 #2672 #1695 #1800 #2955 (fetched 2026-06-11)"
  - "gh issue view oven-sh/bun #27664 (fetched 2026-06-11)"
  - "WebSearch: Express 5 path-to-regexp migration (expressjs/express #6606 #6711 #5948, dev.to)"
summary: "The breakage is concentrated: Hono = RPC type inference under real project structure + middleware security; Express 5 = path-to-regexp wildcard rename; Bun = native addons + node:inspector. Each entry has the failure, the cause, and the fix."
---

# How to read this file
These are the issues an agent building on this stack WILL hit. Each = **symptom → root cause → fix**, pulled from
the actual issue threads (engagement counts in parens). Ranked by how likely turbo is to trip on them.

---

## HONO — the RPC type system is the fragile part (runtime is solid)

### #1746 (CLOSED) — "Absolute imports break `typeof app` for rpc client"
- **Symptom:** importing a route via a **path alias / absolute import** loses the type; relative import works.
  Also breaks with **monorepo** packages and `paths` aliases (v4.0.10+).
- **Root cause:** TS inference limitation, not a Hono bug. Maintainer **yusukebe (verbatim):** _"I am not
  ignoring the issue because I don't see a good solution. If anyone knows of a better way, please let me know."_
- **Fix (GabrielHangor, verbatim):** _"enable `composite: true` in the server subrepo and add path reference in
  the client pointing to tsconfig in the server"_ → use **TS project references**, not `paths` aliases, for the
  app type across packages.

### #2672 (CLOSED, 47 comments) — "Router does not decode URIs"
- **Symptom:** URL-encoded path chars (`%7C` etc.) didn't match routes; encoded params behaved inconsistently
  across Node/Deno.
- **Root cause:** Hono wasn't decoding the URI before matching; a long design debate on decode-once semantics.
- **Resolution (maintainers usualoma + yusukebe):** implemented **`tryDecodeURI()`** + route **`URIError`** to
  `app.onError`. **Takeaway for turbo:** know the current decode behavior before routing on encoded params, and
  register an `onError` that handles `URIError` (malformed-percent-encoding → 400).

### #1695 (CLOSED, 44 comments) — "TypeError: Response body object should not be disturbed or locked"
- **Symptom:** throws when a `Response` body is read twice or an already-consumed Response is returned (common
  in body-inspecting middleware, logging, or retry logic).
- **Root cause:** a Fetch `Response` body is a **one-shot stream**; consuming it twice is illegal.
- **Fix:** clone before reading (`res.clone()`), or read the body once and pass the parsed value downstream.
  **Directly relevant to turbo's streaming work** (ecosystem-08): never re-read a stream.

### #1800 (CLOSED, 29 comments) — "JSON response can't contain Dates"
- **Symptom:** `c.json({ when: new Date() })` → the **RPC client infers `string`, not `Date`** (and the wire
  value is an ISO string).
- **Root cause:** JSON has no Date type; `JSON.stringify` serializes Date→string. Typed RPC surfaces the gap.
- **Fix:** serialize dates to ISO strings explicitly + parse on the client; OR use a serializer (oRPC handles
  Date natively via its own protocol — a reason to prefer oRPC when rich types matter; ecosystem-04). Don't
  expect `Date` round-trips over plain JSON RPC.

### #2955 (29 comments) — "Weird `#private` property in some classes"
- **Symptom:** TS `#private` fields leak into inferred types; structural matching breaks across version/copy
  boundaries → feeds the "Type instantiation is excessively deep" RPC error.
- **Root cause / fix:** version-skew between client and server `hono`. **Pin identical `hono` versions** both
  sides (the canonical RPC monorepo rule).

### Middleware SECURITY wave (April–June 2026, see ecosystem-01)
Not "issues" but the most important breakage signal: **5 security fixes in 4.12.25, 4 in 4.12.21, 3 in 4.12.18,
2 in 4.12.16** — CORS-wildcard-with-credentials, JWT-accepts-any-scheme, **cache-middleware cross-user leakage**,
serve-static path traversal, bodyLimit bypass. **Action: pin ≥ 4.12.25; treat <4.12.16 as vulnerable; audit any
use of CORS/JWT/cache/serve-static middleware.**

---

## EXPRESS 5 — the path-to-regexp wildcard break (the #1 migration footgun)

### expressjs/express #6606 / #6711 — "Missing parameter name at position 1" caused by `*`
- **Symptom:** routes with `*` or `/*` (e.g. `app.all('*', ...)`, `app.get('/*', ...)`) **throw at boot** in
  Express 5: _"Missing parameter name"_.
- **Root cause:** Express 5 upgraded to **path-to-regexp v8**, which **requires wildcards to be NAMED**. Bare
  `*` is no longer valid.
- **Fix:** `*` → **`/*splat`** (or `/{*splat}` to also match root). And the capture changed: wildcards now yield
  an **array** — `req.params.splat = ['foo','bar']` for `/foo/bar` (was a single string in v4).
- **Other Express 5 breaks:** unmatched params are **omitted** from `req.params` (were `''`/`undefined` in v4);
  `express.static` `dotfiles` now defaults to **`ignore`** (v4 served them); async middleware rejections are now
  **auto-forwarded** to error handlers (the one *good* break — kills `next(err)` boilerplate).
- **turbo takeaway:** another reason to default to Hono (Web-standard routing, no path-to-regexp). If a task
  *must* use/upgrade Express, the wildcard rename is the first thing to fix.

---

## BUN — native addons + node:inspector are the real blockers

### oven-sh/bun #27664 (OPEN) — "Current State / Quality Issues"
- **Signal:** community thread on Bun's stability-vs-DX tradeoff (full detail in ecosystem-06).
- **Concrete breakage cited (TheOnlyArtz, verbatim):** _"node:inspector compatibility holding back huge
  adoptions opportunities, speaking from experience from my workplace."_
- **Plus (from WebSearch postmortems):** `bun install --production` can crash without a package cache (pin Bun
  version in CI); native addons via node-gyp (e.g. **`sharp`**) often fail — one migration lost **2 weeks** to
  `sharp` compat (but gained 45% p99 latency).
- **turbo takeaway:** before any Bun migration, audit `sharp`/`bcrypt`/`node-gyp` deps + `node:inspector` usage;
  pin the Bun version in CI.

---

# The pattern across all of it (the meta-lesson for turbo)
1. **Runtimes are solid; the fragility is in (a) type-level RPC contracts under real project structure and
   (b) middleware/security surface.** An agent operating these tools should over-index on tsconfig discipline
   (project references, matched versions, `strict: true`) and on **pinning latest security patches**.
2. **JSON's lack of Date/rich types is a recurring footgun** with typed RPC — serialize explicitly or pick a
   protocol (oRPC) that handles it.
3. **One-shot stream semantics** (Response body) bite both routing and streaming — never re-read a stream.
4. **Migration breaks are concentrated in routing engines** (Express's path-to-regexp; Hono's URI decode) —
   read the migration guide BEFORE bumping a major.
