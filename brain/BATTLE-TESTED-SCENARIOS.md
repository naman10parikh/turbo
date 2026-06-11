---
title: "turbo BATTLE-TESTED-SCENARIOS — Golden Eval Tasks from Real Production/Migration Failures"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [scenarios, eval, golden-tasks, postmortems, production, migration, backend, runtime]
synthesist: SYNTHESIS / taste-node (CP123 Wave-R)
sources: ["brain/research/raw/field-01..06.md", "brain/research/raw/ecosystem-02,03,08,11.md"]
summary: "≥12 real, specific failure/migration/production scenarios with the resolution. Each is a candidate GOLDEN EVAL TASK for Wave S: a fresh agent given the SETUP should produce the RESOLUTION and pass the VERIFY check. Not hypotheticals — every one is grounded in a cited postmortem, issue thread, or dispute."
---

# turbo BATTLE-TESTED-SCENARIOS

> **Purpose.** These are the situations turbo exists to handle. Each scenario is written as a **golden eval task**:
> SETUP (the world state) → TRIGGER (what goes wrong / what's asked) → WRONG MOVE (the trap a naive agent falls into)
> → RESOLUTION (what an expert does) → VERIFY (the binary check that proves it). Wave S lifts these into `eval/` as
> L1 (assertion) / L2 (behavior) / L3 (trajectory) tasks. Every scenario cites the raw postmortem it came from.
>
> **Severity legend:** 🔴 data-loss / security / cross-user bleed · 🟠 outage / boot-break / silent corruption · 🟡 perf / DX / maintainability.

---

## S-01 🔴 The cross-user data bleed (module state under Fluid Compute)
- **SETUP.** A turbo Vercel route in `app/api/report/route.ts` caches a per-request value at module scope to "avoid recomputation": `let userGreeting = "Hello <name>!"` then inside the handler `userGreeting = userGreeting.replace("<name>", body.name)`. Vercel Fluid Compute is default-on; one warm instance serves dozens of concurrent requests.
- **TRIGGER.** Two users hit the endpoint near-simultaneously; "category reports started getting items from other categories." User A sees User B's data.
- **WRONG MOVE.** Blame Fluid Compute / add a mutex / "it works locally so ship it" (local emulators don't reuse containers → the bug is invisible in `vercel dev`).
- **RESOLUTION.** Treat everything outside the handler as a constant. Move mutable state into function scope. For genuine cross-request cache/session, externalize to Upstash/Supabase or pass the ID from the client (the energy `new Map()` law). Run the field-01 audit grep before shipping. *"This is not a Fluid Compute bug; it is a pre-existing code smell that isolation was hiding."*
- **VERIFY.** Grep `app/api/**` finds zero module-scope mutables conditionally assigned in/above a handler and zero `new Map()/Set()`/object-as-cache at module scope. A concurrency test (parallel requests with distinct inputs) returns each caller's own data.
- **Source:** field-01 (Tensult/Dilip Kola 2018 canonical repro + getautonoma 2026 Fluid amplification), field-06 §4.

## S-02 🔴 The PATCH that erased fields (Zod `.default()` data loss)
- **SETUP.** A turbo CRUD resource reuses its create-schema (which has `.default()` on several fields, e.g. `status: z.enum([...]).default('active')`) to validate the PATCH body, with `.partial()` applied.
- **TRIGGER.** A client sends `PATCH /v1/tasks/42` with `{ "title": "new" }` — omitting `status`. After save, `status` has been silently reset to `'active'`, wiping the user's prior value.
- **WRONG MOVE.** Assume `.partial()` makes defaults conditional (it does NOT — Zod 4 `.default()` fires on `undefined` unconditionally, even under `.partial()`).
- **RESOLUTION.** Maintain a **dedicated PATCH schema with NO `.default()`s** (or `.partial()` a base that has no defaults). Never reuse a defaulted create-schema for partial updates.
- **VERIFY.** A test sends a PATCH omitting a defaulted field and asserts the stored value is UNCHANGED (not reset to the default). Code review confirms create-schema and patch-schema are distinct objects.
- **Source:** ecosystem-03 TRAP 1 (pockit.tools / dev.to Zod-4 migration guides).

## S-03 🟠 Express 4→5 bump throws at boot ("Missing parameter name")
- **SETUP.** An inherited Express 4 service with catch-all routes (`app.all('*', handler)`, `app.get('/*', spa)`). A task asks to "update Express to latest."
- **TRIGGER.** After `npm i express@5`, the server **throws at boot**: *"Missing parameter name at position 1."* Nothing serves.
- **WRONG MOVE.** Treat it as a patch / roll back to v4 and give up / blame a dependency.
- **RESOLUTION.** Express 5 uses path-to-regexp v8 which requires **named** wildcards: `*` → `/*splat` (or `/{*splat}` to also match root). Note the capture changed to an **array** (`req.params.splat = ['foo','bar']`). Also: unmatched params are now omitted from `req.params`; `express.static` `dotfiles` defaults to `ignore`. Treat the v4→v5 bump as a *migration*, read the guide. (Bonus: this is a reason turbo defaults to Hono — Web-standard routing, no path-to-regexp.)
- **VERIFY.** Server boots; the catch-all route matches and `req.params.splat` is the expected array; existing routes still resolve.
- **Source:** ecosystem-11 (expressjs/express #6606 #6711), field-05.

## S-04 🟡→🟠 The Bun image-pipeline migration (sharp = 2 weeks)
- **SETUP.** A thumbnail/image-processing API on Node uses `sharp` (native node-gyp addon) on the hot path. A proposal: "migrate to Bun for speed."
- **TRIGGER.** `bun install` / Alpine container fails with missing `.node` binary; `sharp` rebuilds from scratch on every push; two weeks of yak-shaving.
- **WRONG MOVE.** Migrate blind for a marketing "3x faster" claim; discover the native-addon hell mid-flight.
- **RESOLUTION.** (a) Price the native-addon risk BEFORE committing — `sharp` is the single worst-case for Bun. (b) As of **2026-05-13, Bun.Image** (libjpeg-turbo+spng+libwebp compiled into the binary, no native addon) removes the blocker for covered codecs: CI install 4.8s→1.4s, Docker −80MB, within 8% of Sharp, *wins* on 50+ batches. (c) BUT verify your exact needs against Bun.Image's three gaps — no ICC profiles, no animated WebP/GIF, no `.tile()` deepzoom — and keep `sharp` on those paths via dynamic import. The real win (45% p99) was real; it was just an image pipeline, the worst case.
- **VERIFY.** A native-addon audit (`sharp`/`bcrypt`/node-gyp) ran before the decision; if Bun.Image is used, a test confirms the required codecs/features are covered (or `sharp` is retained on the gap paths); CI pins the Bun version.
- **Source:** field-03 Story A (MKBHD-team via WebSearch) + the Bun.Image inversion (omidsaffari 2026-05-13), ecosystem-06.

## S-05 🟠 The 72-hour Bun memory leak (always-on trap)
- **SETUP.** An always-on stateful service runs on Bun; CI and a 1-hour load test are green.
- **TRIGGER.** After **72+ hours** of uptime, intermittent memory leaks appear that never manifested on Node (JavaScriptCore-in-Bun has less multi-day-uptime hardening than V8). One team rolled BACK to Node LTS.
- **WRONG MOVE.** Trust CI + a short load test as proof of always-on stability; have no cheap rollback path.
- **RESOLUTION.** For any always-on service, **soak-test ≥72h before trusting Bun** (YELLOW in the decision matrix). Keep the core in Web-standard / Node-API-safe code (Hono runs on both) so a Bun↔Node swap is a config change, not a rewrite — the rollback path must stay cheap. RED for payments-grade / PM2 / inspector-debug regardless.
- **VERIFY.** A ≥72h soak test exists and is green before an always-on Bun deploy; the runtime is swappable (same handlers run under `@hono/node-server` and Bun) — proven by running the suite under both.
- **Source:** field-03 Story C (media co, patched 1.3.2) + Story D (the rollback, The Register 2026-04-21).

## S-06 🟠 Versioning theater (the 17% gap) + zombie versions
- **SETUP.** turbo ships `/v1` and later `/v2` of a public API. No contract tests; the OpenAPI spec is hand-maintained alongside the code.
- **TRIGGER.** A "non-breaking" change to `/v1` quietly alters an error body / drops an optional field a consumer relied on. Nothing catches it (the team is in the 60% who version but the 83% who don't contract-test). Months later, 2.3 unused versions per service accumulate as nobody sunsets them.
- **WRONG MOVE.** Believe "we version, so we're safe" — versioning is a *promise*; contract testing is the *enforcement*.
- **RESOLUTION.** Be the **17%**: generate OpenAPI from the Zod schemas (`@hono/zod-openapi`) so the validator IS the contract; add runtime-conformance tests (assert real responses parse against the spec) + `oasdiff`/`openapi-diff` in CI to fail on breaking spec diffs. Write the **sunset policy on day 1** (e.g. 12-24 month window + automated deprecation header). Additive-only within a major; breaking ⇒ `/vN+1`.
- **VERIFY.** CI fails when a `/vN` change breaks the spec (oasdiff gate); a sampled response validates against `/openapi.json`; a documented sunset policy + deprecation header exist for each version.
- **Source:** field-04 (Postman 2025 State of API: 60%/17%; 2.3 zombie versions), ecosystem-09.

## S-07 🟠 The framework migration that didn't freeze development (Strangler Fig)
- **SETUP.** A working Express service needs to move to Fastify (reasons: the OpenAPI spec is a "dead document" that diverged from code; Express predates async/await and `express-async-errors` feels bolted-on). The team cannot stop feature work.
- **TRIGGER.** A naive plan proposes a big-bang rewrite → development freeze, high risk, no rollback.
- **WRONG MOVE.** Rewrite all at once; discover mid-flight that a legacy payment integration has no Fastify equivalent.
- **RESOLUTION.** Strangler Fig: first PR adds Fastify and **wraps** the Express app via `@fastify/express`; each successive PR moves a few routes. Feature work continues in parallel. BUT: (a) **audit every middleware/plugin for no-Fastify-equivalent packages BEFORE starting** (legacy payments is the classic landmine); (b) rewrite Express error-middleware as Fastify `setErrorHandler`/hooks (no 1:1 equivalent); (c) `@fastify/express` is a BRIDGE not a destination — leaving it forfeits HTTP/2 and Fastify perf, so finish the strangle. Justify the move by **DX/correctness/observability**, not speed (the framework wasn't the bottleneck).
- **VERIFY.** Migration is incremental (per-route PRs behind the compat wrap), preceded by a dependency-equivalence audit, with a working rollback at each step; the compat bridge is removed by the end.
- **Source:** field-05 (Val Town / Tom MacWright 2024-07, corroborated 2026).

## S-08 🔴→🟠 The SSE stream that dumped (nginx) and swallowed its error (Hono)
- **SETUP.** A turbo agent/LLM endpoint streams tokens via Hono `streamSSE`, deployed behind nginx. The handler does work inside the stream that can throw (e.g. an upstream LLM call).
- **TRIGGER.** Two failures: (1) tokens pile up and arrive as **one giant dump** instead of streaming (the #1 SSE production issue); (2) when the in-stream work throws, Hono's global `onError` **does not fire** (headers already sent) — the client just sees a truncated stream with no error signal.
- **WRONG MOVE.** Add a `try/catch` around the whole route (won't help — stream already started); assume the CDN streams by default; rely on `app.onError`.
- **RESOLUTION.** (1) Set **`X-Accel-Buffering: no`** (+ `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`) so nginx stops buffering. (2) **Pass the optional 3rd-arg error handler** to `streamSSE`; on error, write an `event: error` SSE frame then close. (3) Loop `while (!stream.aborted)` + `stream.onAbort()` so you stop burning LLM tokens when the client leaves; emit a monotonic `id` for `Last-Event-ID` resume; send `: ping` every ~15s when idle. On Workers, set `Content-Encoding: Identity` if `streamText` breaks.
- **VERIFY.** Tokens arrive incrementally through the proxy (not batched); an injected in-stream error produces an `event: error` frame + clean close (not a silent truncation); client disconnect stops token generation.
- **Source:** ecosystem-08 (hono.dev/docs/helpers/streaming + procedure.tech/buildmvpfast 2026).

## S-09 🟠 The RPC client that lost its types (monorepo / absolute imports)
- **SETUP.** turbo's backend and a TS frontend live in separate monorepo packages. The frontend imports the app type via a `paths` alias / absolute import to build `hc<AppType>()`.
- **TRIGGER.** The RPC client is typed `unknown`, OR tsc throws *"Type instantiation is excessively deep and possibly infinite"*. The same import written **relative** works.
- **WRONG MOVE.** Fight the types with `as any` (violates the law) / downgrade Hono / give up on typed RPC. Also: forget that client+server `hono` versions must match exactly (skew → `#private` field leak → the same "excessively deep" error).
- **RESOLUTION.** This is a TS inference limitation, not a Hono bug (maintainer: *"I don't see a good solution"*). Use **TS project references**: `composite: true` in the server package + a `references` entry from the client's tsconfig pointing at the server's. Do NOT rely on `paths` aliases for the app type. **Pin identical `hono` versions** both sides. Ship **`hcWithType`** (precompiled client type), never raw `hc`, in any app >~20 routes — also fixes the "IDE melts / compile your code before using it" slowdown.
- **VERIFY.** The RPC client is fully typed (not `unknown`); tsc does not throw "excessively deep"; the repo uses project references (not `paths`) for the cross-package app type; `hcWithType` is the exported client and `hono` versions match.
- **Source:** ecosystem-02 (Hono RPC gotchas + issue #1746, maintainer yusukebe + fix GabrielHangor), ecosystem-11 (#2955).

## S-10 🟡 Scaffolding the energy-law-compliant service from scratch
- **SETUP.** A task: "stand up a new turbo backend service" (TS strict, Zod-at-boundary, typed routes, OpenAPI, structured logs, tests, <400-line files).
- **TRIGGER.** A naive agent hand-rolls a flat `index.ts` that grows past 400 lines and breaks RPC inference (un-chained routes), or invents a bespoke validation layer instead of Zod.
- **WRONG MOVE.** Build from a blank file; use a random 0-5★ "hono-drizzle-zod" exercise repo; copy the reference repo WITHOUT bumping its stale deps.
- **RESOLUTION.** Use **`w3cj/hono-open-api-starter`** as the skeleton baseline — it wires the entire law (Hono + `@hono/zod-openapi` + Drizzle+`drizzle-zod` + Zod + Pino/`hono-pino` + Scalar + Vitest + Stoker) and demonstrates the route-group file layout (`{name}.routes.ts`/`.handlers.ts`/`.index.ts`/`.test.ts` chained into one `AppType`) that reconciles "chain `.route()`" with "<400 lines." **Bump before use:** `@hono/zod-openapi`→1.x, Zod→4.4.3, Hono→≥4.12.25 (security wave). Add `/health`, `/openapi.json`+Scalar UI, `hcWithType` export, `eslint-plugin-neverthrow`.
- **VERIFY.** `tsc --noEmit` passes (no `any`); every boundary has a Zod parse; routes are chained into one `AppType`; no file >400 lines; `/openapi.json` serves and a response validates against it; deps are at the bumped versions (`npm view` confirms).
- **Source:** ecosystem-10 (w3cj/hono-open-api-starter #1 ranked), ecosystem-01 (version floors).

## S-11 🔴 The Hono middleware CVE wave (pin or bleed)
- **SETUP.** A turbo service uses Hono CORS + JWT + cache + serve-static middleware, pinned at an older 4.12.x (or `^4.12.0` resolving to <4.12.16).
- **TRIGGER.** It's exposed to: CORS wildcard-origin-WITH-credentials leak; JWT middleware accepting **any** Authorization scheme (not just `Bearer`); **cache middleware cross-user leakage**; serve-static path traversal (`%5c`/`%2e%2e`); bodyLimit bypass via understated `Content-Length` on Lambda.
- **WRONG MOVE.** Trust `^4.12.0`; assume the JWT middleware validates the scheme; treat the cache middleware as safe per-user without checking the cache key.
- **RESOLUTION.** **Pin ≥ 4.12.25; treat <4.12.16 as vulnerable.** Audit any use of CORS/JWT/cache/serve-static. Never set CORS `origin: *` with `credentials: true`. The cache cross-user leak is exactly the `new Map()`-class bug (shared mutable state across requests) — echo (rate-limit/cache) must treat cache-key isolation as first-class. The meta-pattern: Hono's *runtime* is solid; the *middleware surface* is where the CVEs live.
- **VERIFY.** `npm view hono version` confirms ≥4.12.25 pinned (exact or `~`); no CORS wildcard+credentials combo; JWT paths reject non-Bearer schemes; cache keys are per-user/isolated.
- **Source:** ecosystem-01 (the security wave: 5 fixes in 4.12.25, 4 in 4.12.21, 3 in 4.12.18), ecosystem-11.

## S-12 🟡 The Date that round-tripped as a string (typed RPC + JSON)
- **SETUP.** A Hono RPC handler returns `c.json({ createdAt: new Date() })`; the TS client consumes it via `hc<AppType>`.
- **TRIGGER.** The client infers `createdAt: string` (not `Date`), and the wire value is an ISO string — downstream `.getTime()` calls fail or silently coerce.
- **WRONG MOVE.** Expect `Date` to round-trip over plain JSON (it can't — `JSON.stringify` serializes Date→string; typed RPC just surfaces the gap sharply).
- **RESOLUTION.** Serialize dates to ISO strings explicitly and `new Date(...)` on the client; document it in the contract. OR — if rich types (Date/URL/Set/Map/File) matter pervasively — use **oRPC**, which handles them natively via its own protocol (no SuperJSON). This is a concrete reason to prefer oRPC for external rich-type APIs.
- **VERIFY.** Either the client explicitly parses ISO strings to `Date` (and the contract documents the wire type as string), or oRPC is used and a Date survives the round-trip as a `Date`.
- **Source:** ecosystem-11 (Hono #1800), ecosystem-04 (oRPC native types).

## S-13 🟠 Native TS in CI without a type-check (the silent-`any` deploy)
- **SETUP.** turbo adopts Node 24 native `.ts` execution (`node app.ts`, no build step) for fast cold starts. CI runs `bun test` / `node --test` and deploys.
- **TRIGGER.** A type error (a real `any`, a wrong shape) ships to production because **type-stripping does NOT type-check** — `amaro` strips, it does not validate, and it ignores `tsconfig.json`. The energy "no any" law is silently violated.
- **WRONG MOVE.** Assume "it runs, so the types are fine"; rely on the runtime to enforce the law.
- **RESOLUTION.** Keep a **`tsc --noEmit` CI gate** — non-negotiable under the energy law; the runtime won't enforce it. Also avoid `enum`/value-`namespace`/decorators in turbo's code (type-stripping breaks them; prefer union types + `as const` over enums anyway) and don't rely on `compilerOptions.paths` at runtime (amaro ignores them — use project references). "No build" ≠ "no CI."
- **VERIFY.** CI contains a `tsc --noEmit` step that fails on type errors; grep finds no `enum`/value-`namespace`/experimental-decorator usage in turbo's own code; runtime path resolution does not depend on `paths`.
- **Source:** field-06 §1, §8 (hirenodejs 2026-05-27).

---

## How Wave S should use these
- **L1 (assertions):** S-02, S-04, S-11, S-13 → single-fact checks (schema distinct? version pinned? `tsc --noEmit` present? codec audited?).
- **L2 (behavior):** S-01, S-03, S-08, S-09, S-12 → give the agent the broken SETUP, assert it produces the RESOLUTION and the VERIFY passes.
- **L3 (trajectory):** S-05, S-06, S-07, S-10 → multi-step (soak-test plan / sunset+contract policy / Strangler-Fig migration / scaffold-from-reference) where the *process* is graded, not just the endpoint.
- **No-self-grading** (per dsip.json): the VERIFY line is the objective gate — an assertion or a deterministic check, never the agent's own opinion that it's done.
