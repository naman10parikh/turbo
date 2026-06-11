---
title: "ECOSYSTEM Research — Final Report, Gaps & Sources (turbo backend/runtime, June 2026)"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [report, gaps, sources, ecosystem, backend]
researcher: ECOSYSTEM (CP123 Wave-R)
summary: "Final report for the turbo backend/runtime ecosystem research. 14 files, ~30 cited sources, top findings, and 3 unconfirmed items for GAPS-AND-DISPUTES."
---

# Final Report — turbo Backend/Runtime Ecosystem (June 2026)

## Files written (all under brain/research/raw/, prefix `ecosystem-`)
- `ecosystem-00-INDEX.md` — index + the energy law quoted (~47 lines)
- `ecosystem-01-versions-changelogs.md` — versions + 6mo deltas, Hono security wave, Node EOL (~95 lines)
- `ecosystem-02-hono.md` — Hono deep dive, RPC gotchas, vs Express/Fastify (~115 lines)
- `ecosystem-03-zod.md` — Zod v4, the PATCH-default trap, Standard Schema (~105 lines)
- `ecosystem-04-api-design.md` — REST/RPC, OpenAPI-first, versioning (~95 lines)
- `ecosystem-05-result-error-handling.md` — neverthrow/Effect/try-catch (~95 lines)
- `ecosystem-06-bun-runtime.md` — Bun honest assessment + Anthropic acquisition (~85 lines)
- `ecosystem-07-edge-runtimes.md` — CF Workers vs Vercel (~75 lines)
- `ecosystem-08-streaming.md` — SSE vs WS, Hono streamSSE, nginx trap (~95 lines)
- `ecosystem-09-contract-testing.md` — Pact vs OpenAPI vs RPC-types (~75 lines)
- `ecosystem-10-starter-repos.md` — 5 best repos ranked (~70 lines)
- `ecosystem-11-github-issues.md` — real breakage, symptom→cause→fix (~105 lines)
- `ecosystem-12-tradeoff-matrix.md` — 6 decision tables + default stack (~75 lines)
- `ecosystem-13-agent-operator.md` — CLIs/MCPs an agent needs (~95 lines)
- `ecosystem-99-REPORT.md` — this file

Total: 15 files, ~1,400 lines, every claim cited inline with URL + date.

## Top 10 findings (one line each)
1. **Node 20 hit EOL 2026-04-30** — the checklist's "Node 20+" is now stale; floor = **22**, default = **24 LTS**.
2. **Hono shipped a dense SECURITY WAVE** (5 fixes in 4.12.25, 4 in 4.12.21, 3 in 4.12.18): CORS-wildcard+creds,
   JWT-accepts-any-scheme, **cache-middleware cross-user leak**, serve-static traversal — **pin ≥ 4.12.25**.
3. **Hono's fragility is the RPC TYPE SYSTEM, not the runtime** — absolute/alias imports + monorepos break
   `typeof app`; maintainer admits no clean fix; the answer is **TS project references (`composite: true`)**.
4. **Zod 4's `.default()` causes DATA LOSS on PATCH** (applies unconditionally on `undefined`, even with
   `.partial()`) — use a dedicated no-default PATCH schema. Also `z.coerce` input→`unknown`, stricter UUID.
5. **Zod 4 is 14x faster string parsing + 2.3x smaller + 10x fewer tsc instantiations** than v3 — the v3
   IDE-perf pain is largely solved; `zod/mini` (1.88kb) for edge bundles.
6. **Standard Schema makes the validator swappable** — Zod/Valibot/ArkType implement it; Hono/tRPC/TanStack
   consume it; bind via `@hono/standard-validator` to keep the choice open.
7. **Bun was ACQUIRED BY ANTHROPIC** (Nov/Dec 2025, tied to Claude Code's $1B run-rate; stays MIT/OSS) — and is
   ~95-98% Node-compatible, but its perf edge collapses to **~3%** once a DB is involved; native addons (`sharp`)
   + `node:inspector` are the real blockers. Use Bun for CLIs/tests/edge, Node for the core service.
8. **SSE wins for LLM/agent streaming** (OpenAI/Anthropic/Gemini all use SSE; HTTP/2 multiplexes; auto-reconnect)
   — WebSocket only for bidirectional/interrupts. **THE production trap = nginx buffering → `X-Accel-Buffering: no`.**
9. **Hono `onError` does NOT fire once a stream starts** — must pass the 3rd-arg error handler to `streamSSE`.
10. **The stack is going agent-native:** `vercel logs -j` (JSON Lines) + `vercel discover --format=json`,
    `wrangler tail`, the CF docs MCP, and **`@hono/mcp`** (turbo's own services can BE MCP servers).

## Bonus findings (also load-bearing)
- **oRPC v1** is the most interesting 2026 API entrant: one codebase → typed-TS client AND real OpenAPI REST,
  with **native Date/URL/Set/Map** (no SuperJSON) and CF WebSocket-Hibernation support. Default for external
  rich-type APIs; Hono RPC for internal TS-only.
- **Express 5's #1 migration break:** path-to-regexp v8 requires **named** wildcards — bare `*` throws "Missing
  parameter name"; fix `*` → `/*splat`; wildcards now capture an **array**.
- **`w3cj/hono-open-api-starter`** is THE reference repo — wires the entire energy law (Zod-at-boundary + typed
  routes + OpenAPI + Pino + Vitest + the <400-line file-split) in one skeleton.
- **Contract testing:** "schema valid" < "compatible"; 2026 best practice = provider-owned OpenAPI everywhere +
  spec-diffing + runtime conformance, add Pact selectively. turbo's Hono-RPC type IS a compile-time contract.

## Boundary respected (echo's territory, documented not owned)
Rate-limiting + response caching = **Wave-2 echo**. Seam documented in ecosystem-04/07/08: turbo defines the
cache-control/ETag semantics in the OpenAPI contract + the SSE replay-buffer hook; echo implements the store
(Upstash/KV/Durable Objects). Both bound by the energy `new Map()` law — cross-request state is external-store
only. Flagged `rhinobase/hono-rate-limiter` (642★) as echo's de-facto tool, not turbo's.

---

# THREE THINGS I COULD NOT CONFIRM (for GAPS-AND-DISPUTES)

> **UPDATE 2026-06-11 (2nd pass):** Gaps 1 & 2 are now CLOSED in `ecosystem-14-verification-and-gap-closure.md`;
> Gap 3 confirmed as a deliberate non-claim (resolve by measurement, not citation). Originals retained below for
> the record, with resolution inline.

1. **Vercel's CURRENT minimum Node version (post-Node-20-EOL).** ~~Not verified.~~ **CLOSED (ecosystem-14):**
   Vercel offers **24.x (default) / 22.x / 20.x**; it still allows Node 20.x even though upstream EOL'd 2026-04-30
   (Vercel backports security patches independently). **turbo → pin `engines.node: "24.x"`** (Vercel default +
   native TS + not-upstream-EOL). Source: vercel.com/docs/functions/runtimes/node-js/node-js-versions.

2. **Exact `@hono/zod-openapi` v1.0 breaking changes vs 0.x.** ~~Not pulled.~~ **CLOSED (ecosystem-14):** v1.0's
   only break is the **Zod 3→4 peer bump** (v1 requires Zod ≥4); v1.4.0 additionally needs **Hono ≥4.10**. No
   code-API rewrite. Consequence: adopting v1 **forces the whole Zod-4 migration**, incl. the `.default()`-on-PATCH
   data-loss trap — re-audit every PATCH schema. The `hono-open-api-starter` structure transfers; its version pins
   do not. Source: honojs/middleware zod-openapi CHANGELOG.

3. **The precise Hono RegExpRouter throughput vs Express/Fastify head-to-head.** **Confirmed as a non-claim
   (ecosystem-14 Gap 3):** no apples-to-apples 2026 benchmark exists; the decision is already resolved by the
   practitioner layer (framework rarely the bottleneck; honest migrations moved for DX/correctness, not speed).
   **Action: run an in-repo benchmark on turbo's own request shape if a perf call ever hinges on it.**

## NET-NEW from the 2nd pass (see ecosystem-14)
- **neverthrow is PARKED, not abandoned:** last release 8.2.0 was **2025-02-21** (16mo), last commit Feb 2026 was
  docs-only. Stable for a frozen API, but no longer actively developed. turbo's Result<T,E> default → **hand-rolled
  discriminated union (zero-dep, Simplicity First)**; Effect (`3.21.3`, shipping weekly) if it wants batteries.
- **Hono RPC typed-error/custom-fetch gaps are issue-backed** (open: #4270, #4560, #4765, #4954) → use **oRPC** for
  typed errors across the wire / external consumers; Hono RPC for internal TS-only happy path.
- **Every Hono `stream*` MUST pass the 3rd-arg error handler** (verbatim docs: `onError` does NOT fire mid-stream;
  default sends errors to `console.error` — the exact anti-pattern the energy law bans). Hono has **no built-in SSE
  keepalive** — turbo implements its own heartbeat; `X-Accel-Buffering: no` for the nginx-buffering trap.

---

# Sources (≈30 distinct, all accessed 2026-06-11)
**Primary / official docs & repos:** hono.dev/docs (rpc, benchmarks, helpers/streaming, validation);
github.com/honojs/hono (issues #1746, #2672, #1695, #1800, #2955; releases); github.com/honojs/middleware
(zod-openapi, mcp); jsr.io/@hono/mcp; github.com/oven-sh/bun (issue #27664); github.com/nodejs/Release
(schedule.json); zod.dev/v4 + /v4/changelog; github.com/standard-schema/standard-schema;
github.com/supermacro/neverthrow; orpc.dev/docs/comparison; effect.website; expressjs.com/en/guide/migrating-5;
github.com/expressjs/express (#6606, #6711, #5948); github.com/w3cj/hono-open-api-starter;
github.com/AmanVarshney01/create-better-t-stack; github.com/honojs/examples; github.com/cloudflare/chanfana;
github.com/cloudflare/workers-mcp; developers.cloudflare.com/agents + /workers/wrangler/commands;
vercel.com/docs/cli + vercel.com/changelog (agent-optimized logs/discover).
**Anthropic/Bun acquisition (verified):** anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone;
bun.com/blog/bun-joins-anthropic; redmonk.com/sogrady/2026/06/04; news.ycombinator.com/item?id=46124258.
**Secondary / analysis (2026-dated, used for synthesis + trade-offs):** pkgpulse.com; pockit.tools;
souvenirlist.com; dev.to/last9; dev.to/pockit_tools; byteiota.com; strapi.io/blog; infoq.com (Bun v3.1);
blog.logrocket.com (trpc-vs-orpc); supastarter.dev; speakeasy.com (versioning, pact-vs-openapi);
buildwithfern.com; redocly.com; digitalapi.ai; asoasis.tech; totalshiftleft.ai; pactflow.io; docs.pact.io;
stevekinney.com; websocket.org; procedure.tech; callsphere.ai; buildmvpfast.com; render.com; MDN (SSE);
kunalganglani.com; morphllm.com; propicked.com; digitalapplied.com; mcpservers.org (wrangler skill);
mhart/mcp-hono-stateless.

**Currency note:** All package versions via live `npm view` on 2026-06-11. All web sources cross-checked for
2026 dates; where a doc page mislabeled a year (the Hono releases WebFetch said "2024"), I corrected against the
authoritative npm `time` field. Anything older than 6 months that I still trust (e.g. the hono-open-api-starter
repo, last push Oct 2025) is explicitly flagged with a "bump before use" note.
