---
title: "Bun Production-Readiness — The Honest 2026 Assessment"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [bun, runtime, node, performance, production]
sources:
  - "github.com/oven-sh/bun issue #27664 (OPEN, fetched 2026-06-11; 93,084★, 7,087 open issues)"
  - "WebSearch: Bun 1.3 production-ready 2026 (dev.to/last9, byteiota, strapi, infoq, tech-insider)"
  - "github.com/oven-sh/bun repo stats (pushed 2026-06-11)"
summary: "Bun 1.3.14, ~95-98% Node compat. The checklist's '8-15ms cold' is real for Bun.serve but the throughput edge collapses to ~3% once a DB is involved. Native addons (sharp) + node:inspector are the real blockers. NEW: Bun was acquired by Anthropic. Verdict for turbo: Bun for CLIs/edge/scripts + test runner; Node 22/24 LTS for the core service."
---

# The checklist claim, scrutinized
energy checklist (line 265): _"Bun production-ready (8–15ms cold; consider for edge/CLI)."_ This file tests
that claim against June-2026 reality. **Current: bun@1.3.14. 93,084★, 7,087 open issues, last push 2026-06-11.**

## What's TRUE (Bun's real wins)
- **Cold start / startup is genuinely fast.** Bun starts much faster than Node (the "8–15ms" class for a
  `Bun.serve` handler). Great for **CLIs, edge functions, short-lived scripts, and CI**.
- **`Bun.serve()` raw throughput** is ~**177% faster** than Node's `http` module (microbenchmark).
- **npm compatibility ~95–98%** in 2026 — "thousands of companies running it in production" (dev.to/last9).
- **All-in-one DX**: runtime + bundler + test runner + package manager + built-in SQLite/Postgres clients +
  `.env` loader, zero-config. The **test runner** (`bun test`) is a legitimately good reason to adopt Bun even
  in a Node project.
- **TypeScript/JSX run directly**, no build step.

## What's the CATCH (the part marketing omits)
- **The throughput edge mostly vanishes under real load.** Once you add Express-style middleware + JSON
  serialization + DB queries, the gap shrinks to **40–70%**, and a production-grade test found **Bun 12,400
  req/sec vs Node 12,000 — <3% difference** when DB + routing dominate (byteiota/strapi 2026). i.e. **your app's
  bottleneck is the DB, not the runtime.** Don't migrate for "speed" on a DB-bound service.
- **Native addons break.** Modules needing **node-gyp** compilation often fail. A real migration postmortem:
  **45% p99 latency reduction, BUT two weeks of work** lost to `sharp` (native image lib) compatibility
  (WebSearch 2026). If your stack uses `sharp`, `bcrypt`, `better-sqlite3`-class native modules — test FIRST.
- **`node:inspector` gaps block enterprise adoption.** Verbatim from issue #27664: _"node:inspector
  compatibility holding back huge adoptions opportunities, speaking from experience from my workplace."_
  (TheOnlyArtz). Debugging/profiling tooling that relies on the inspector protocol may not work.
- **1.3 breaking changes to know:** `Bun.serve()` TS types were reworked; the **SQL client now throws if called
  as a function instead of a tagged-template literal**; `bun install --production` has a known crash without a
  package cache → **pin your Bun version in CI and test the config**.
- **Issue volume:** 7,087 open (vs Node ~1.7k). The thread's own rebuttal (sanny-io, verbatim): _"Issue count is
  not really a reliable indicator... TypeScript has 5k open issues"_ — fair, but the **density of compat edge
  cases** is the real signal, not the raw count.

## The community's honest framing (issue #27664, OPEN)
- The thread's thesis: even post-acquisition, Bun's marketing is still **"obsessed with the performance
  narrative,"** while shipping scope-creep features (native Markdown rendering — _"is rendering Markdown really
  the proper job of a JavaScript Runtime?"_) instead of hardening compat.
- Counter-view (YanGeruch, verbatim): _"People who value stability over everything aren't going to choose bun
  anyway... People who choose bun are making a conscious choice to compromise stability for DX and performance.
  Bun states their goal is 100% compatibility with node which is incredibly ambitious."_

## BIG ECOSYSTEM SIGNAL (flag for the whole fleet)
Issue #27664 references Bun being **"acquired by Anthropic."** If accurate, Bun is now an Anthropic-owned
runtime — which is strategically relevant to an Anthropic-aligned platform like Energy (first-party runtime
alignment, potential Claude-Code/agent-runtime synergy). **GAP: I could not independently confirm the
acquisition from a primary Anthropic/Bun announcement within this session — see GAPS. Treat as a strong lead to
verify, not settled fact.**

---

# turbo's verdict (where Bun fits in a backend/runtime harness)
1. **Core HTTP service:** default to **Node 22/24 LTS** (Hono on `@hono/node-server`). Most stable, widest
   compat, and the runtime is not your bottleneck. Don't bet the product surface on Bun's remaining 2–5% compat
   gap.
2. **Bun is the right call for:** CLIs/tools (`tools/`), edge functions where startup latency matters, build
   scripts, and — notably — **`bun test`** as the test runner even in Node projects (fast, zero-config).
3. **Migration rule:** before any "move the service to Bun" task, run an explicit **native-addon audit**
   (`sharp`/`bcrypt`/`node-gyp` deps) + **`node:inspector`** dependency check, and **pin the Bun version in
   CI**. If those pass and the workload is CPU/startup-bound (not DB-bound), Bun's a clear win.
4. **Because Hono is runtime-agnostic, this is a low-risk bet:** the *same* Hono app runs on Node OR Bun OR edge.
   turbo can start on Node and move specific surfaces to Bun without rewriting handlers — the adapter changes,
   the code doesn't. This is the strongest argument for the Hono+Bun combination.

> Deno note: Deno 2.x is the third runtime; strong Web-standard + security-by-default + native TS, and now
> npm-compatible. Not the checklist default, but Hono runs on it too. Relevant only if a task specifically wants
> Deno's permission model or Deno Deploy. Bun > Deno for turbo's "fast CLI + test runner" use case.
