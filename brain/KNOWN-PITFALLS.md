---
title: "turbo KNOWN-PITFALLS — Version-Specific Gotchas with Detection + Avoidance"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [pitfalls, gotchas, version-specific, detection, avoidance, hono, zod, bun, node, express]
synthesist: SYNTHESIS / taste-node (CP123 Wave-R)
sources: ["brain/research/raw/ecosystem-01,02,03,05,08,11,13,14.md", "brain/research/raw/field-01,06.md"]
summary: "The fast-lookup gotcha table. Each pitfall: WHAT bites · the VERSION/CONDITION it bites under · how to DETECT it (a grep/command/symptom) · how to AVOID it. Distinct from BATTLE-TESTED-SCENARIOS (narrative eval tasks) — this is the reference an agent scans mid-build."
---

# turbo KNOWN-PITFALLS

> **How to use.** Before editing any turbo backend code, scan the table for the surface you're touching (Hono / Zod /
> Node / Bun / streaming / RPC). Each row is **symptom → version/condition → detection → fix**. Version-pinned so a
> future agent knows when a pitfall expired. The detection column is the load-bearing part — it's what makes the
> pitfall *checkable*, not just *memorable*.

---

## P-01 — "Node 20+" is stale; Node 20 is EOL
- **Bites:** targeting Node 20 (the checklist + much 2025 tooling still say "20+").
- **Condition:** as of **2026-04-30** Node 20 (Iron) hit EOL / maintenance ended. Node 18 died 2025-04-30.
- **Detect:** `engines.node` in `package.json` says `>=20` / `20.x`; CI runs on Node 20; `node -v` < 22.
- **Avoid:** floor = **Node 22** (maintenance → Apr 2027), default = **Node 24** (Krypton, Active LTS → Oct 2027). **Pin `engines.node: "24.x"`.** Gap-1 CLOSED (ecosystem-14): Vercel offers 24.x(default)/22.x/20.x and backports security to 20.x, but ship 24.x — don't pin upstream-dead 20.x. (source: ecosystem-01, ecosystem-14 GAP 1 → GAPS Gap-1)

## P-02 🔴 — `new Map()` / module-scope state on Vercel is now RACY, not just empty
- **Bites:** any cross-request cache/session/counter at module scope in `app/api/**`; the lazy-init `if (!cachedClient) cachedClient = createClient()`.
- **Condition:** Vercel **Fluid Compute default-on (2026)** — one warm instance serves dozens (peaks past 250) of concurrent requests. (Also still empty on cold start.)
- **Detect:** grep `app/api/**` for `let X = null; … if (!X) X =` in/above a handler; module-level arrays/objects that `.push`/accumulate; `new Map()`/`new Set()`/`{}` used as a cache at module scope. **Cannot be detected from `vercel dev`** — emulators don't reuse containers.
- **Avoid:** externalize to Upstash/Supabase or pass the ID from the client (the energy law). A DB *connection pool* is safe at module scope (it manages its own concurrency); a raw lazily-assigned client ref is not. (source: field-01, field-06 §4 → SCENARIO S-01)

## P-03 🟠 — Hono RPC type loss (the #1 Hono footgun, four flavors)
- **Bites:** `hc<AppType>` client typed `unknown`, or tsc *"Type instantiation is excessively deep and possibly infinite"*, or IDE/tsserver melts as routes grow.
- **Condition:** (a) app type imported via `paths` alias / absolute import / across monorepo packages; (b) routes not chained; (c) client+server `hono` versions differ (skew → `#private` field leak); (d) >~20 routes with raw `hc`; (e) **async arrow-function handlers** silently lose inference (open issue #4765).
- **Detect:** RPC client members resolve to `unknown`/`any`; tsc error text "excessively deep"; tsserver lag on the client file. Same import written **relative** works (the tell). For (e): an async arrow handler's route resolves to `unknown` while a named async fn for the same route types correctly.
- **Avoid:** (a) **TS project references** (`composite: true` server + `references` from client), NOT `paths` aliases — maintainer admits no clean fix; (b) chain `.route('/a',a).route('/b',b)` in ONE composition file; (c) **pin identical `hono` versions** both sides; (d) ship **`hcWithType`** (precompiled client type), never raw `hc`; (e) prefer **named async functions or explicit return types** on RPC handlers over async arrows. **For typed errors across the wire / a custom fetch / external consumers, the open-issue ledger (#4270, #4560, #4954, #3495) says use oRPC, not Hono RPC.** (source: ecosystem-02, ecosystem-11 #1746 #2955 #3148, ecosystem-14 NEW-2 → SCENARIO S-09, OPINION O-07)

## P-04 🔴 — Zod `.default()` data loss on PATCH
- **Bites:** reusing a create-schema (with `.default()`s) to validate a PATCH body silently overwrites omitted fields with defaults.
- **Condition:** **Zod 4** — `.default()` fires on `undefined` **unconditionally, even under `.partial()`**.
- **Detect:** the same schema object validates both POST and PATCH; a PATCH omitting a defaulted field resets it on save.
- **Avoid:** a **dedicated PATCH schema with NO `.default()`s** (or `.partial()` a no-default base). Never reuse a defaulted create-schema for partial updates. (source: ecosystem-03 TRAP 1 → SCENARIO S-02)

## P-05 🟡 — Zod v3→v4 migration breaks (four mechanical ones)
- **Bites:** compile breaks + behavior changes on the v4 upgrade.
- **Condition:** **Zod 3 → 4**.
- **Detect / Avoid (each):**
  - `z.coerce.number()` input type is now **`unknown`** → new TS errors where v3 narrowed input; tighten upstream type or accept `unknown` (the errors are *correct*).
  - `z.string().email()/.url()/.uuid()` deprecated → `z.email()/z.url()/z.uuid()`; **`z.uuid()` is RFC-9562/4122 strict** (validates variant bits) and rejects non-canonical UUIDs v3 accepted → use `z.guid()` for permissive matching. **Audit stored "UUIDs" that aren't canonical.**
  - error customization: `message`/`invalid_type_error`/`required_error`/`errorMap` collapsed into one **`error`** param; use `z.prettifyError()` for display.
  - `.merge()` removed → `.extend()` or `{ ...A.shape, ...B.shape }`.
  - Ecosystem floor: `zod-validation-error` must be **≥ v5.0.0**. Codemods: `zod-v3-to-v4` / Hypermod automate the renames. (source: ecosystem-03 TRAPs 2-5)

## P-06 🟠 — Express 5 path-to-regexp wildcard boot-break
- **Bites:** routes with bare `*` (`app.all('*')`, `app.get('/*')`) **throw at boot** in Express 5: *"Missing parameter name."*
- **Condition:** **Express 5** (path-to-regexp v8). Treat the v4→v5 bump as a migration.
- **Detect:** server fails to start after `express@5`; error text "Missing parameter name at position 1".
- **Avoid:** `*` → **`/*splat`** (or `/{*splat}` for root). Wildcards now capture an **array** (`req.params.splat = [...]`). Also: unmatched params omitted from `req.params` (were `''`/`undefined`); `express.static` `dotfiles` defaults to `ignore`; async rejections auto-forward (the one *good* break). (source: ecosystem-11 #6606/#6711, field-05 → SCENARIO S-03)

## P-07 🟠 — neverthrow: "promise-returning" ≠ "async" (sync throw escapes the Result)
- **Bites:** a function returns a Promise but throws **synchronously** (validation before `await`); `fromPromise` only catches rejections → the sync throw escapes your Result boundary uncaught.
- **Condition:** **neverthrow** + a non-`async` promise-returning thrower.
- **Detect:** an uncaught exception originating from a function you wrapped with `ResultAsync.fromPromise`.
- **Avoid:** for non-`async` promise-returners, use `fromThrowable` (catches the sync throw too), or wrap in an `async` IIFE first. (source: ecosystem-05)

## P-08 🟠 — Unconsumed Result silently drops the error (the law's fire-and-forget)
- **Bites:** a `Result`/`ResultAsync` is created but never `.match`ed/`.unwrapOr`ed → the error is silently dropped (exactly the "fire-and-forget" the energy law bans).
- **Condition:** **neverthrow** without lint enforcement.
- **Detect:** a function returns a Result that a caller ignores; no eslint error.
- **Avoid:** **`eslint-plugin-neverthrow` is non-optional** in the lint config — it enforces every Result is consumed (Rust `#[must_use]` semantics). (source: ecosystem-05 → OPINION O-03)

## P-09 🟠 — Native TS type-stripping does NOT type-check (silent `any` ships)
- **Bites:** type errors reach production because `node app.ts` strips types without validating them.
- **Condition:** **Node 22/23/24** native `.ts` execution (`amaro`). amaro ignores `tsconfig.json`.
- **Detect:** CI has no `tsc --noEmit` step; a known type error still "runs". Also: `enum`/value-exporting-`namespace`/decorators break at strip-time; JSX not stripped; `compilerOptions.paths` ignored at runtime.
- **Avoid:** keep a **`tsc --noEmit` CI gate** (non-negotiable under the energy law — the runtime won't enforce "no any"). Avoid `enum`/`namespace`/decorators in turbo's code (prefer union types + `as const`); don't depend on `paths` at runtime (use project references). (source: field-06 §1, §8 → SCENARIO S-13)

## P-10 🟠 — SSE tokens batch behind nginx (the #1 streaming prod issue)
- **Bites:** SSE/LLM tokens pile up and arrive as one dump instead of streaming.
- **Condition:** any reverse proxy that buffers by default (**nginx** especially); some CDNs.
- **Detect:** the stream "works" locally but arrives all-at-once through prod; client sees a long pause then a burst.
- **Avoid:** send header **`X-Accel-Buffering: no`** on streaming routes (+ `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`). On Workers, set `Content-Encoding: Identity` if `streamText` malfunctions. (source: ecosystem-08 → SCENARIO S-08, OPINION O-12)

## P-11 🟠 — Hono `onError` does NOT fire once a stream starts
- **Bites:** an error thrown inside a `streamSSE`/`stream` callback is NOT caught by `app.onError` → silent truncation, no error signal to the client.
- **Condition:** **Hono** streaming — response headers/status already sent (can't turn 200 into 500).
- **Detect:** a stream that throws mid-flight just stops; no error frame; `app.onError` never logs it.
- **Avoid:** **pass the optional 3rd-arg error handler** to `streamSSE`/`stream`; handle errors inside the stream (write `event: error` frame, then close). Also `while (!stream.aborted)` + `stream.onAbort()` to stop on disconnect. (source: ecosystem-08 → SCENARIO S-08)

## P-12 🟡 — Response body is one-shot (re-read throws "disturbed or locked")
- **Bites:** *"TypeError: Response body object should not be disturbed or locked"* when a `Response` body is read twice (body-inspecting middleware, logging, retry) or an already-consumed Response is returned.
- **Condition:** any Fetch-`Response` (Hono, edge) — the body is a single-consumption stream.
- **Detect:** the error text; middleware that reads `await c.req.json()`/the body before the handler also reads it.
- **Avoid:** `res.clone()` before reading, or read once and pass the parsed value downstream. Never re-read a stream (directly relevant to turbo's streaming work). (source: ecosystem-11 #1695, ecosystem-08)

## P-13 🟡 — `@hono/mcp`: reaching for `c` (Context) inside a tool def is awkward
- **Bites:** trying to access the Hono `Context` from inside an `@hono/mcp` tool definition is clumsy/fragile.
- **Condition:** **`@hono/mcp`** (Streamable HTTP transport).
- **Detect:** tool code that reaches for `c.get(...)`/request context and behaves unexpectedly.
- **Avoid:** pass what the tool needs **explicitly** into the tool, rather than reaching for `c`. Use stateless tools unless cross-call session state is genuinely required. (source: ecosystem-13, honojs discussion #4452)

## P-14 🟡 — `bun install --production` can crash without a package cache
- **Bites:** CI `bun install --production` crashes when there's no warm package cache; also the 1.3 SQL client now **throws if called as a function** instead of a tagged-template literal; `Bun.serve()` TS types were reworked.
- **Condition:** **Bun 1.3.x** in CI.
- **Detect:** install step crashes on a cold CI runner; SQL calls throw type/runtime errors after a Bun bump.
- **Avoid:** **pin the Bun version in CI** and warm/test the install config; use tagged-template literals for the SQL client; re-check `Bun.serve()` types after a bump. (source: ecosystem-06, ecosystem-11)

## P-15 🟡 — Node-native replacements that are still EXPERIMENTAL
- **Bites:** dropping a dependency for a native API that isn't production-stable yet.
- **Condition:** **Node 22+** native-first wave.
- **Detect:** code relies on `--env-file` for var-expansion/multiple files; `node:sqlite` on a perf-tuned path; **global `WebSocket` for a WS *server***; `util.styleText` for rich theming.
- **Avoid:** keep `dotenv` (var-expansion/multi-file), a community SQLite driver (perf tuning), and **`ws` for WebSocket servers** (turbo's streaming) until these go stable. Drop only the STABLE ones (`fetch`, `node:test`, `fs.glob`, `crypto.randomUUID`, `fs.rm`). Don't cargo-cult "zero dependencies" past the experimental line. (source: field-06 §2)

## P-16 🟡 — Hono router URI-decode semantics on encoded params
- **Bites:** URL-encoded path chars (`%2F`, `%7C`) match routes inconsistently across Node/Deno; malformed percent-encoding can surface as a `URIError`.
- **Condition:** **Hono** routing on `:param` containing encoded chars (resolved via `tryDecodeURI()` + route `URIError` → `app.onError`).
- **Detect:** an encoded path segment doesn't match the expected route; a `URIError` reaches the client unhandled.
- **Avoid:** know the current decode behavior before routing on encoded params; register an `app.onError` that maps `URIError` (malformed encoding) → **400**. (source: ecosystem-11 #2672)

---

## The meta-pattern across every pitfall (carry this)
1. **Runtimes are solid; the fragility is in (a) type-level RPC contracts under real project structure and (b) the middleware/security surface.** Over-index on **tsconfig discipline** (project references, matched versions, `strict: true`) and on **pinning latest security patches**.
2. **JSON's lack of Date/rich types** recurs with typed RPC — serialize explicitly or pick a protocol (oRPC) that handles it.
3. **One-shot stream semantics** (Response body) bite both routing and streaming — never re-read a stream.
4. **Migration breaks concentrate in routing engines** (Express path-to-regexp, Hono URI decode) — read the migration guide BEFORE a major bump.
5. **2026's fixes moved the risk, didn't delete it** — type-safety enforcement moved into CI (`tsc --noEmit`), state risk from cold-empty to warm-racy, the native-dep line to stable-vs-experimental. (source: ecosystem-11, field-06)
