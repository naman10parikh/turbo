---
title: "Verification Pass + Gap Closure — Backend/Runtime (turbo), 2026-06-11"
type: source
created: "2026-06-11"
updated: "2026-06-11"
tags: [verification, gaps, vercel, hono-rpc, neverthrow, orpc, streaming, bun]
researcher: ECOSYSTEM (CP123 Wave-R — second pass)
sources:
  - "npm view (live, 2026-06-11) — 14 packages"
  - "vercel.com/docs/functions/runtimes/node-js/node-js-versions (page last_updated 2026-02-27, fetched 2026-06-11)"
  - "github.com/honojs/middleware zod-openapi CHANGELOG (fetched 2026-06-11)"
  - "github.com/supermacro/neverthrow (gh api, 2026-06-11)"
  - "gh search issues honojs/hono RPC (2026-06-11)"
  - "hono.dev/docs/helpers/streaming (fetched 2026-06-11)"
  - "orpc.dev/docs/comparison (fetched 2026-06-11; redirected from orpc.unnoq.com)"
  - "anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone + bun.com/blog/bun-joins-anthropic + builtin/siliconangle/techstartups (2025-12-02)"
summary: "Second-pass verification of the ecosystem-* corpus. All 14 canonical versions re-confirmed live (unchanged). Closes the three open gaps from ecosystem-99-REPORT (Vercel Node min, @hono/zod-openapi v1 breaks, framework perf) and adds three NET-NEW findings the first pass missed: neverthrow maintenance slowdown, the exact Hono RPC issue ledger, and the verbatim Hono streaming error/abort API."
---

# Why this file exists

The first ECOSYSTEM pass (`ecosystem-00..13`, `ecosystem-99-REPORT`) is thorough and well-cited. This pass does
NOT duplicate it. It does three things the no-slop / consolidate-don't-expand rules demand:
1. **Re-verify** the load-bearing version + currency claims against live sources today (2026-06-11).
2. **Close the three open gaps** the first pass itself flagged in `ecosystem-99-REPORT.md`.
3. **Surface three NET-NEW findings** the first pass missed.

---

# PART 1 — Live version re-verification (all UNCHANGED, corpus is current)

`npm view <pkg> version` run live 2026-06-11. Every number matches `ecosystem-01-versions-changelogs.md` exactly
— the corpus has not gone stale:

| Package | Version (live 2026-06-11) | Published | Matches corpus? |
|---|---|---|---|
| hono | 4.12.25 | 2026-06-09 | ✅ |
| zod | 4.4.3 | 2026-05-04 | ✅ |
| fastify | 5.8.5 | 2026-04-14 | ✅ |
| express | 5.2.1 | 2025-12-01 | ✅ |
| neverthrow | 8.2.0 | **2025-02-21** | ✅ (but see Part 3 — stale) |
| @hono/zod-openapi | 1.4.0 | 2026-05-09 | ✅ |
| @hono/zod-validator | 0.8.0 | 2026-05-09 | ✅ |
| @hono/node-server | 2.0.4 | 2026-05-24 | ✅ |
| @orpc/server | 1.14.5 | 2026-06-05 | ✅ (bumped 0.x→ since corpus note) |
| @trpc/server | 11.17.0 | 2026-04-28 | ✅ |
| effect | 3.21.3 | 2026-06-05 | ✅ |
| valibot | 1.4.1 | 2026-05-24 | ✅ |
| arktype | 2.2.0 | 2026-03-04 | ✅ |
| undici | 8.4.1 | 2026-06-08 | ✅ |

**Bun-Anthropic acquisition RE-CONFIRMED from primary source** (the first pass cited it; this pass verified the
URL resolves and corroborated with 6 outlets): announced **2025-12-02**, Anthropic's first-ever acquisition,
Claude Code at $1B run-rate, Bun stays the runtime that ships Claude Code. Sources: anthropic.com/news/anthropic-
acquires-bun-…, bun.com/blog/bun-joins-anthropic, builtin.com, siliconangle.com, techstartups.com, adweek.com
(all 2025-12-02). Bun repo today: **93,085★, 7,087 open issues, org still `oven-sh`, last push 2026-06-11**
(`gh api repos/oven-sh/bun`). The high open-issue count corroborates the "narrow green-light" taste in
`ecosystem-06` / `field-03` — acquisition did not magically close the production-readiness gaps.

---

# PART 2 — The three open gaps, CLOSED

## GAP 1 (CLOSED) — Vercel's current minimum Node version post-Node-20-EOL

**Question (from ecosystem-99):** Node 20 hit upstream EOL 2026-04-30. Did Vercel bump its build minimum / drop
Node 20 builds?

**ANSWER — verified from Vercel's own docs** (`vercel.com/docs/functions/runtimes/node-js/node-js-versions`,
page `last_updated: 2026-02-27`, fetched 2026-06-11):

> Current available versions are: **24.x (default)**, **22.x**, **20.x**.

**The nuance the first pass couldn't confirm — now confirmed:** Vercel **still offers Node 20.x** even though
upstream Node 20 reached EOL on 2026-04-30. Vercel decouples its runtime support from the upstream Node Release
schedule and **backports security patches itself** — the docs say verbatim: *"Vercel automatically rolls out minor
and patch updates when needed, such as to fix a security issue."* So "Vercel needs Node 20.9+" in the checklist is
**not stale on Vercel** — 20.x is still a valid target there — but it IS stale as general advice (upstream 20 is
dead).

**Resolution of the apparent contradiction with `ecosystem-01` / `field-06`:**
- Upstream truth (nodejs/Release): Node 20 EOL 2026-04-30; Node 24 = Active LTS; Node 22 = maintenance.
- Vercel truth: 20/22/24 all available; **24.x is the default for new projects**; only major versions are
  selectable (minor/patch auto-managed).
- **turbo's decision (now fully grounded):** set `"engines": { "node": "24.x" }`. This (a) matches Vercel's
  default, (b) gets native `.ts` type-stripping + sub-200ms cold starts (`field-06` Inversion 1), (c) avoids
  shipping on an upstream-EOL'd runtime even though Vercel would still let you. Node 22 is the conservative floor
  if a dependency hasn't certified 24 yet.
- **Caveat retained:** the Vercel docs page is dated 2026-02-27 (pre-Node-20-EOL). Vercel **could** drop 20.x
  builds at any time now that upstream is dead (they deprecated Node 18 builds in 2025 on the same logic). turbo
  should not pin 20.x regardless — pin 24.x. Re-check this page at build time only if forced onto 20 by a dep.

## GAP 2 (CLOSED) — Exact `@hono/zod-openapi` v0.x → v1.0 breaking changes

**Question (from ecosystem-99):** what breaks for repos still on 0.x (e.g. `w3cj/hono-open-api-starter`, last
push Oct 2025) when adopting v1?

**ANSWER — verified from the package CHANGELOG** (github.com/honojs/middleware zod-openapi, fetched 2026-06-11):

The v1.0.0 break is **purely a peer-dependency shift, not a code-API rewrite**:
1. **v1.0.0:** *"Zod OpenAPI has been migrated the Zod version from v3 to v4. As a result, the `zod` in
   `peerDependencies` has been updated to 4.0.0 or higher."* — i.e. **v1 REQUIRES Zod 4**.
2. **v1.4.0:** bumped the **Hono peer dep from ≥4.3.6 to ≥4.10.0** (the 4-argument `MiddlewareHandler` type
   landed in Hono 4.10). So v1.4.0 needs **Hono ≥ 4.10**.
3. `@hono/zod-validator` updated peer requirements in lockstep.
4. The changelog indicates **no other code-level breaking changes** — the upgrade is dependency-driven, not a
   refactor of `createRoute`/`OpenAPIHono` call sites.

**The load-bearing consequence for turbo:** adopting `@hono/zod-openapi@1.4.0` **forces a Zod 3→4 upgrade** across
the whole boundary layer. That is NOT free — it drags in the entire Zod-4 migration surface the corpus already
documented:
- the **`.default()`-on-PATCH data-loss trap** (`ecosystem-03-zod.md`): Zod 4 applies `.default()`
  unconditionally on `undefined`, even under `.partial()` — a real correctness bug on PATCH routes.
- `z.coerce` input type → `unknown`; stricter UUID; the `zod/v4` import path.
- **Upside:** Zod 4 is ~14× faster string parsing, ~2.3× smaller, ~10× fewer tsc instantiations (`ecosystem-03`).
- **`w3cj/hono-open-api-starter` (Oct 2025, on 0.x + Zod 3):** still a valid skeleton to learn the *wiring* from,
  but **do not adopt its pinned versions wholesale** — when you lift it, upgrade to `@hono/zod-openapi@^1.4`,
  `zod@^4.4`, `hono@^4.12.25`, and run the Zod-4 codemod / re-test every PATCH schema. The structure transfers;
  the version pins do not.

## GAP 3 (CLOSED enough) — Hono vs Express/Fastify head-to-head perf

**Question (from ecosystem-99 + field-99):** no single apples-to-apples 2026 benchmark of all three on the same
hardware; Hono's own page omits direct Express/Fastify rows and Hono is "less battle-tested at extreme scale on
Node specifically."

**ANSWER — this stays a deliberate NON-CLAIM, and that is the correct finding.** The practitioner layer already
resolved the *decision* without needing the missing benchmark (`field-02`, `field-99` Dispute B):
- Under a real DB, all three frameworks converge (~10–13K r/s) — **the framework is rarely the bottleneck.**
- The honest migration stories (Val Town, `field-05`) moved for **DX / correctness / observability, NOT speed.**
- One benchmark author swept the synthetic test with Hono (5,618 r/s, 37% less memory than Fastify) **and then
  shipped Fastify anyway** for team familiarity (`field-02`).
- **turbo's rule:** do not pick the framework on a marketing RPS number. If a perf decision ever hinges on it,
  **run an in-repo benchmark on turbo's own request shape** — the corpus is explicit that this gap is closed by
  measurement, not citation. The remaining genuinely-open sub-question ("Hono on *Node* at *extreme* scale") is
  real but only matters if turbo runs Hono on a heavy always-on Node service rather than edge — which contradicts
  Hono's edge-first sweet spot anyway.

---

# PART 3 — Three NET-NEW findings (missed by the first pass)

## NEW 1 — `neverthrow` has MARKEDLY SLOWED (maintenance-velocity flag)

`ecosystem-01` lists neverthrow 8.2.0 as "the canonical Result<T,E> lib" with no velocity caveat. Live data
(`gh api repos/supermacro/neverthrow`, `npm view neverthrow time`, 2026-06-11) shows a **sharp cadence drop**:

- **Release history:** 2024 was monthly (6.2.1 Apr→7.0 Jul→8.0 Sep→8.1 Oct 2024), then **8.2.0 on 2025-02-21 and
  NOTHING since** — 16 months with no release.
- **Last commit 2026-02-14**, and it was *"Merge … add-demo-gif"* / README image — **docs only, not code**.
- **77 open issues, 7,554★, NOT archived.** Maintainer (supermacro) still merges the occasional PR but the engine
  is idling.

**Honest read for turbo:** neverthrow is **stable, widely used, and NOT abandoned** — but it is in low-maintenance
mode, not active development. For a tiny, frozen-by-design API (Result/ResultAsync, `ok`/`err`, `.map`/`.andThen`)
that's *acceptable* — there's little left to add and the energy law (`Result<T,E>, never try-catch-swallow`) only
needs the core primitives. But weigh it honestly:
- If turbo wants a **batteries-included, actively-developed** typed-error system → **Effect** (`effect@3.21.3`,
  published 2026-06-05 — *actively shipping*) is the heavyweight alternative, at the cost of a large learning curve
  and a whole-program paradigm. The first pass already flagged Effect as heavyweight; this pass adds the
  *velocity contrast* — Effect is alive and weekly, neverthrow is parked.
- A third option the corpus underweights: **hand-rolled discriminated-union Result** (`type Result<T,E> =
  { ok: true; value: T } | { ok: false; error: E }`) with zero deps satisfies the energy law directly, dodges
  the maintenance question entirely, and is the most "Simplicity First" (Karpathy) choice for a service that only
  needs the pattern, not the library. **Recommended default for turbo unless it needs neverthrow's combinators.**

## NEW 2 — The exact Hono RPC issue ledger (the real cost of `typeof app` type inference)

`ecosystem-02`/`ecosystem-11` correctly identify that **Hono's fragility is the RPC type system, not the runtime**.
This pass pulls the *live open-issue ledger* (`gh search issues --repo honojs/hono "RPC type"`, 2026-06-11) so
turbo knows the specific landmines before choosing Hono RPC:

- **#4765 (open)** — *"BUG: RPC types broken when using arrow function with a Promise."* Directly corroborates
  `field-06`/`ecosystem-11`: async arrow-function handlers can silently lose RPC type inference. **Gotcha: prefer
  named async functions or explicit return types on RPC handlers.**
- **#4560 (open)** — *"RPC Client types are too tightly coupled to native fetch API, making custom fetch hard."*
  If turbo needs a custom fetch (auth headers, retries, a different transport), the RPC client types fight you.
- **#4270 (open RFC)** — *"Add type helpers for type-safe error handling in RPC Client."* **Hono RPC has no
  first-class typed-error story yet** — the client doesn't carry your error union. This is exactly the gap that
  pushes rich-typed/error-heavy APIs toward **oRPC** (which DOES have typed errors).
- **#4954 (open)** — *"[rpc] Typing for DetailedError."* Same theme: error typing on the RPC boundary is unfinished.
- **#3495 (open)** — *"Extend type safe RPC with zod validator (to numbers at least)."* Query/param coercion +
  RPC types interaction is rough (ties to the Zod `z.coerce` note in `ecosystem-03`).

**Synthesis for turbo:** Hono RPC is excellent for **internal, TS-only, happy-path** typed calls. The moment you
need **(a) typed errors across the wire, (b) a custom transport/fetch, or (c) an external/non-TS consumer**, the
open-issue ledger says you're swimming upstream — and that's precisely where **oRPC** (typed errors + native
OpenAPI + native Date/Map/Set/File, verified below) is the better 2026 pick. This is the concrete, issue-backed
version of the corpus's "Hono RPC internal / oRPC external" recommendation.

## NEW 3 — The VERBATIM Hono streaming error + abort API (load-bearing for turbo's streaming work)

`ecosystem-08` states "Hono `onError` does NOT fire once a stream starts." This pass pulls the **exact official
guidance** (`hono.dev/docs/helpers/streaming`, fetched 2026-06-11) so turbo's streaming code is correct on the
first write, not the third:

- **Verbatim:** *"If the callback function of the streaming helper throws an error, the `onError` event of Hono
  will **not** be triggered."* Reason: `onError` runs *before* the response starts; once bytes flush, the response
  can't be overwritten.
- **The ONLY correct error path = the 3rd argument:**
  ```ts
  stream(c, async (stream) => { /* ... */ }, (err, stream) => { /* handle: log or write to stream */ })
  ```
  Verbatim: *"The third argument of the streaming helper is an error handler. This argument is optional, if you
  don't specify it, the error will be output as a console error."* → **turbo rule: ALWAYS pass the 3rd-arg handler
  on `stream`/`streamSSE`/`streamText`.** Omitting it doesn't just lose the error to the client — it buries it in
  `console.error`, violating the energy law's "every catch must `console.warn("[module] context:", …)` or comment
  why it's silent." The default Hono behavior is the *exact* anti-pattern the energy rule bans.
- **Client-abort handling (NET-NEW detail):** `stream.aborted` (boolean, poll it: `while (!stream.aborted) {…}`)
  and `stream.onAbort(() => {…})` (register cleanup). `stream.sleep(ms)` for paced sends.
- **GAP turbo must fill itself:** the Hono streaming docs **do NOT document an SSE keepalive/ping pattern**. For a
  long-lived agent/LLM stream behind a proxy, turbo must implement its own heartbeat (periodic `: ping\n\n`
  comment frame) — Hono won't do it for you. (And remember the `field`/`ecosystem-08` nginx trap:
  `X-Accel-Buffering: no` or the proxy buffers your SSE into uselessness.)

## NEW 3b — oRPC v1 distinctives RE-VERIFIED from primary docs

`field-06`/`ecosystem-99` recommend oRPC as the 2026 typed-RPC pick. This pass confirms from `orpc.dev/docs/
comparison` (fetched 2026-06-11) that the headline claims hold:
- **File/Blob end-to-end type safety:** oRPC *"First-class, built-in support"* vs tRPC *"Lacks features"* vs
  ts-rest/Hono *"Not supported."*
- **Native types (Date, URL, Set, Map, …):** supported natively — **no SuperJSON** — vs tRPC "requires
  workarounds," ts-rest/Hono "lack support."
- **OpenAPI:** multi-schema OpenAPI support + bracket-notation that competitors lack.
- **Cloudflare WebSocket Hibernation:** *"fully supported for oRPC only."*
- **Honest limitation oRPC self-discloses:** it leads on type-safety + modern framework integrations, **not** on
  ecosystem maturity vs tRPC's established community. Fair flag — oRPC is younger; weigh community/StackOverflow
  depth if that matters to turbo.
- **Version note:** `@orpc/server` is now **1.14.5 (2026-06-05)** — actively shipping, v1 stable line.

---

# PART 4 — Net deltas to fold into the brain docs (for whoever synthesizes)

1. **`engines.node`: pin `"24.x"`** (Vercel default + native TS + not-upstream-EOL). Node 22 = conservative floor.
   Vercel still allows 20.x but upstream 20 is dead — don't pin it.
2. **Adopting `@hono/zod-openapi@1.x` ⇒ mandatory Zod 3→4 migration** ⇒ **re-audit every PATCH schema** for the
   `.default()` data-loss trap. The reference starter's version pins are stale; its structure is not.
3. **Result<T,E> choice has 3 honest options, ranked by turbo's likely need:** hand-rolled discriminated union
   (Simplicity First, zero-dep — **default**) > neverthrow (stable but *parked* since 2025-02) > Effect (alive,
   heavyweight, whole-program). The first pass treated neverthrow as the unqualified canonical pick; it's stable
   but no longer actively developed.
4. **Hono RPC typed-errors / custom-fetch / external-consumer = use oRPC instead** — backed by the live open-issue
   ledger (#4270, #4560, #4765, #4954), not just taste.
5. **Every Hono `stream*` call MUST pass the 3rd-arg error handler** (else errors vanish into console.error,
   violating the energy law) + implement your own SSE keepalive (Hono doesn't) + `X-Accel-Buffering: no`.
