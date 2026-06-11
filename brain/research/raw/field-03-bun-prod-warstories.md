---
title: "When Bun Is Actually Safe in Prod — The Migration War Stories with Blast Radius (June 2026)"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [bun, production, migration, postmortem, memory-leak, sharp, native-addons, decision-boundary]
sources:
  - "byteiota.com/bun-runtime-production-guide-2026-speed-vs-stability (2026-04-01, fetched 2026-06-11)"
  - "omidsaffari.com/blog/bun-1-3-14-image-sharp-migration-playbook (2026-05-13 release, fetched 2026-06-11)"
  - "theregister.com — 'Bun 1.1.13 out with memory fixes as dev complain of leaks' (2026-04-21, via WebSearch)"
  - "WebSearch synthesis: tech-insider, hirenodejs, strapi, buildmvpfast, pickuma Bun-vs-Node 2026"
  - "gh api repos/oven-sh/bun (live: 93,084★, 7,087 open issues, 2026-06-11)"
related: ["[[ecosystem-06-bun-runtime]]", "[[field-06-2026-invalidates-2025]]"]
summary: "ecosystem-06 has the honest assessment; this file has the lived migrations with their blast radius. Four real stories: MKBHD's team (sharp = 2 weeks, +45% p99), a gaming studio (8→5 servers, clean), a media co (72hr memory leak, patched 1.3.2), and a team that rolled BACK to Node LTS. Plus the 2026 inversion: Bun.Image (May 13 2026) designed the #1 blocker (sharp/node-gyp) out of existence. The decision boundary, quoted."
---

# Scope note
ecosystem-06 already scrutinizes the "8-15ms cold / <3% under DB" claim and the Anthropic acquisition. This file
is the **migration-postmortem layer**: who moved, what broke, how long it took, who moved back, and the precise
**"use Bun for X, Node for Y"** boundary as stated by practitioners — plus the single biggest 2026 change that
shifts the boundary.

---

## THE FOUR WAR STORIES (with blast radius)

### Story A — MKBHD's tech team: sharp cost 2 weeks, bought 45% p99
**Source:** WebSearch (tech-insider / migration guides, 2026). Migrated a **thumbnail-processing API** Node→Bun.
- **Win:** _"45% reduction in p99 latency."_
- **Blast radius:** _"the migration took two weeks because of native addon compatibility issues with sharp."_
- **Lesson:** the win was real and large — but it was an **image pipeline**, the single worst-case for Bun
  (native addon on the hot path). Two weeks of yak-shaving for a latency win you should price in *before*
  committing.

### Story B — mobile gaming studio: 8→5 servers, zero issues after 3 months
**Source:** WebSearch (buildmvpfast / production SaaS 2026). Migrated Node→Bun **January 2026**.
- **Win:** consolidated _"from 8 servers to 5 due to Bun's superior WebSocket performance and lower memory
  footprint per connection,"_ reporting _"zero stability issues after 3 months in production."_
- **Why it worked:** **WebSocket-heavy, connection-fan-out workload** — exactly where Bun's lower per-connection
  memory shines, and **no native addons in the critical path.** This is the green-light profile.

### Story C — media company: 72-hour memory leak (the long-process trap)
**Source:** WebSearch synthesis (2026). Next.js 15 app on Bun.
- **Win:** _"35% build time improvements and 22% latency reduction."_
- **The bite:** _"intermittent memory leaks in long-running processes (72+ hours) that did not manifest in
  Node.js. The Bun team acknowledged and patched the issue in Bun 1.3.2."_
- **Lesson:** Bun's weak spot is **long-uptime processes** — V8's GC has a decade more hardening than
  JavaScriptCore-in-Bun for multi-day uptime. Leaks that never show in CI or a 1-hour load test surface at
  72h. **If turbo runs a always-on service, soak-test ≥72h before trusting Bun.**

### Story D — the rollback: a team went BACK to Node LTS
**Source:** WebSearch (theregister 2026-04-21 + buildmvpfast). _"One team migrating back to Node LTS after
hitting persistent memory issues."_ The Register's framing (2026-04-21): **"Bun 1.1.13 out with memory fixes as
dev[s] complain of leaks."**
- **Lesson:** the rollback is the most honest data point. Bun migration is **reversible if you keep it behind a
  thin runtime-agnostic boundary** — which is itself an argument for writing turbo's core in plain
  Web-standard / Node-API-safe code (Hono helps here: same code runs on Node AND Bun).

---

## THE DECISION BOUNDARY (byteiota, 2026-04-01, verbatim)

### Use Bun for:
> - "New projects without legacy Node.js dependencies"
> - "Microservices with strict latency SLAs (sub-100ms startup matters)"
> - "High-throughput APIs where 4x faster startup enables rapid scaling"
> - "Developer tooling where startup speed impacts user experience"
> - "Simple dependency trees you can test upfront"

### Stick with Node.js for:
> - "Enterprise systems requiring LTS guarantees and maximum stability"
> - "Complex native modules (heavy node-gyp usage, custom C++ bindings)"
> - "Legacy codebases with deep Node.js integrations"
> - "Zero-tolerance environments where 4.7k open issues signal unacceptable risk"

### The expectation-management quote (the one to tattoo on a migration proposal):
> "Your API won't serve 3x more traffic just by switching runtimes — real apps with databases perform
> identically across Bun, Deno, and Node.js."

**Live receipt:** Bun is at **7,087 open issues / 93,084★** (gh, 2026-06-11). The open-issue count is the
byteiota "4.7k" hedge, now higher — read it as "huge surface, fast-moving, not zero-risk," not "broken."

---

## THE 2026 INVERSION — Bun.Image killed the #1 blocker (sharp/node-gyp)
**Source:** omidsaffari playbook; Bun.Image shipped **2026-05-13 in Bun 1.3.14.** This is the most important
*new* fact for the Bun decision in turbo's domain — it directly invalidates the dominant 2025 anti-Bun argument.

- **The old pain (verbatim):** _"npm rebuild sharp runs from scratch on every push"_ when Node versions change;
  _"Alpine containers fail with missing .node binary files."_ Sharp/node-gyp was the reason Stories A and the
  ecosystem-06 "2 weeks lost to sharp" postmortem existed.
- **What Bun.Image is:** _"libjpeg-turbo + spng + libwebp compiled directly into the Bun binary,"_ a chainable
  API mirroring Sharp's — **no native addon to install or rebuild.**
- **Quantified wins (verbatim):**
  - CI install: **4.8s→1.4s warm, 18.2s→7.1s cold.**
  - Docker image: **~80MB smaller** (no Sharp prebuilt binary, no Alpine `vips-dev`).
  - Latency: within **8%** of Sharp on a 1024→512 WebP resize; Bun.Image *wins* on batches of 50+ via
    _"zero-copy ArrayBuffer borrowing."_
- **Caveats (verbatim — keep Sharp for these):** no ICC color-profile pass-through, no animated WebP/GIF frame
  access, no `.tile()` deepzoom pyramid. Author's advice: keep Sharp _"on those code paths"_ via dynamic import,
  don't migrate wholesale.

**turbo lesson:** if image processing was the *only* thing keeping turbo on Node, that blocker is largely gone
as of May 2026 — but verify your exact codec/feature needs against the three Bun.Image gaps first. This is a
textbook example of the platform *fixing the foot-gun*, not the user routing around it.

---

## THE OTHER STANDING BLOCKERS (still real in June 2026)
From ecosystem-06 + this round's searches — what Bun.Image did NOT solve:
1. **`node:inspector` gaps** — _"holding back huge adoptions opportunities"_ (issue #27664, TheOnlyArtz). Debug/
   profile tooling on the inspector protocol may not attach.
2. **APM/observability** — _"every serious APM vendor (Datadog, New Relic, Sentry, OpenTelemetry) ships Node
   agents that just work, while Bun support is newer, sometimes experimental, occasionally requires manual
   instrumentation."_ For an observable production service this is a real tax.
3. **PM2 / cluster semantics** — _"subtle differences in process.binding, internal modules, and cluster
   semantics break tools like PM2."_
4. **Long-uptime GC** — Story C's 72h leak class. Soak-test before trusting always-on.
5. **Remaining native addons** — bcrypt (→bcryptjs), sqlite3, ffmpeg wrappers still bite; "mostly there" is
   _"not a word you want on the critical path for payments or media processing."_

---

## THE turbo TAKE (where Bun is safe, concretely)
**GREEN — use Bun now:** CLIs, the **test runner** (`bun test` even inside a Node project), edge/short-lived
functions, scripts, CI, **WebSocket-fan-out services with no native addons** (Story B), and image work that
fits Bun.Image's covered codecs (post-May-2026).
**YELLOW — gate behind a soak test:** always-on stateful services (72h GC risk), anything needing rich APM.
**RED — stay on Node 22/24 LTS:** heavy node-gyp/C++ bindings on the hot path, payments-grade critical paths
that can't tolerate "mostly compatible," PM2/cluster-dependent ops, inspector-based debugging requirements.
**Architecture hedge:** write turbo's core in Web-standard / Node-API-safe code (Hono runs on both) so a
Bun↔Node swap is a config change, not a rewrite — Story D proved the rollback path must stay cheap.

> One-line taste: **Bun's wins are real on startup, memory-per-connection, and DX; the runtime is almost never
> your DB-bound app's bottleneck. Adopt it where startup/edge/WS/tooling matters; keep the always-on,
> native-addon, payments-grade core on Node LTS until your own 72h soak test says otherwise.**
