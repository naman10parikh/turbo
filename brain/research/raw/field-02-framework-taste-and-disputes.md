---
title: "Hono vs Fastify vs Express — Receipts, Practitioner Taste, and Where Experts Disagree (June 2026)"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [hono, fastify, express, elysia, taste, benchmarks, disputes, framework-choice]
sources:
  - "Sohail x Codes, Medium, 2025-10-31 — 'I Built the Same Backend in Hono, Fastify, and Express' (fetched 2026-06-11)"
  - "Alex Aslam, dev.to, 2025-06-15 — 'Beyond Express: Fastify vs. Hono' + comments (fetched 2026-06-11)"
  - "gh api repos/{honojs/hono,fastify/fastify,expressjs/express,elysiajs/elysia} (live, fetched 2026-06-11)"
  - "WebSearch synthesis: betterstack, pkgpulse, adyog, bswen framework comparisons 2026"
related: ["[[ecosystem-02-hono]]", "[[ecosystem-12-tradeoff-matrix]]"]
summary: "The ecosystem files own the matrix; this file owns the TASTE and the DISAGREEMENTS. Two independent practitioners converge on the same non-obvious recommendation (split the stack: Fastify monolith + Hono edge). The real dispute is 'best benchmark' vs 'best for a team' — and the numbers say Hono while shipped production stacks still say Fastify. Plus the dependency-tree taste that benchmarks miss."
---

# Scope note (no matrix re-derivation)
The honest tradeoff matrix lives in `ecosystem-12-tradeoff-matrix.md` and the Hono deep-dive in
`ecosystem-02-hono.md`. This file adds the layer those can't: **what named engineers actually believe**, where
**credible sources disagree** (verbatim, both sides → feeds GAPS-AND-DISPUTES), and the **dependency-tree taste**
that throughput benchmarks systematically omit.

---

## LIVE RECEIPTS (gh api, 2026-06-11) — the popularity vs momentum split
| Framework | ★ | open issues | last push | read |
| --- | --- | --- | --- | --- |
| Express | 69,144 | 216 | 2026-06-02 | biggest install base, still actively maintained post-v5 |
| Fastify | 36,463 | **150** | 2026-06-10 | **lowest open-issue count of the four** — a maturity/health signal |
| Hono | 30,906 | 369 | 2026-06-09 | fastest-rising; issue count reflects the RPC-type-inference churn (ecosystem-11) |
| Elysia | 18,500 | 337 | 2026-06-11 | Bun-native challenger; most daily commits but smallest base |

**Taste read of the table:** Express's ★ lead is *legacy install base*, not momentum. Fastify's **150 open
issues** (less than half of Hono/Elysia despite a comparable ★ count) is the quiet signal of a mature,
well-triaged project. Don't read ★ as "best"; read open-issue-ratio and push recency as "healthy."

---

## RECEIPT — the one production-shaped benchmark (not hello-world)
**Sohail x Codes, 2025-10-31.** Explicitly NOT synthetic: JWT auth + Postgres (simple + complex joins) + S3
image resize/upload + third-party API calls + schema validation + error logging. 100 concurrent connections,
60s, POST with auth+validation+DB-insert.

| | Express | Fastify | Hono |
| --- | --- | --- | --- |
| req/s | 1,847 | 4,231 | **5,618** |
| avg latency | 53.2ms | 23.1ms | **17.4ms** |
| p99 | 187ms | 94ms | **71ms** |
| memory | 156MB | 142MB | **98MB** |

**Hono won every metric** — including 37% less memory than Fastify. **And the author still shipped Fastify.**
That contradiction is the whole point of this file (see DISPUTE 1).

> ⚠️ **Calibration vs the other benchmark.** The ecosystem corpus and other 2026 sources report that under a
> *DB-bound* workload the three **converge** (Express ~10K, Fastify ~13K, Hono ~12K RPS — `ecosystem-12`). The
> Sohail numbers show a *wider* spread because his test adds S3 + JWT + third-party calls (more JS-layer work
> per request, where framework overhead shows). **Reconciliation:** the more your per-request cost is pure DB
> wait, the more the frameworks converge; the more it's app-layer JS (auth, serialization, validation), the
> more Hono/Fastify pull ahead of Express. turbo should benchmark *its own* request shape, not trust either
> number blind.

---

## TASTE 1 — "best numbers" ≠ "what we shipped" (the honest practitioner)
**Sohail x Codes (verbatim), after Hono swept his benchmark:**
> "our team knows Node.js patterns and Fastify felt more familiar. The learning curve was smaller."

His decision rule (verbatim):
> "Use Express if you need stability and community. Use Fastify if you need performance in Node.js. Use Hono if
> you need maximum efficiency."

And the scale caveat (verbatim):
> "If you're handling 100 requests per second, Express is totally fine."

**Why this is taste, not fact:** the *data* said Hono; the *engineer* weighted team familiarity and ecosystem
fit over a benchmark win. Great engineers optimize the system (team + maintenance + hiring), not the
microbenchmark. turbo, as an *agent operator* with no "team familiarity" cost, should weight differently than a
human team would — the familiarity tax is near-zero for an LLM that reads docs fresh each time.

---

## TASTE 2 — split the stack, don't pick one winner (the convergent opinion)
**Alex Aslam, dev.to, 2025-06-15 (verbatim split):**
- **Main API → Fastify** (JSON-heavy routes; "JSON serialization 2x faster than Express"; cited 22,000 RPS vs
  Express 8,000, p99 85ms→32ms).
- **Edge caching → Hono** (geo-distributed logic; "~5x smaller than Express," zero deps, cold start 120ms vs
  450ms, 18MB memory).
- **Claimed result:** "3x throughput, 60% lower cloud costs."

**Convergence worth noting:** *two independent practitioners* (Sohail's decision tree + Aslam's explicit split)
land on the same architecture — **Fastify for the stateful monolith, Hono for the edge layer.** This is the
closest thing to consensus in the 2026 framework debate: it's not Hono-vs-Fastify, it's **Hono-AND-Fastify by
layer.** For turbo this maps to: Hono when the target is Cloudflare Workers / edge / multi-runtime (the
checklist's stated default for CF Workers), Fastify/Node when it's a long-lived stateful Node service.

---

## TASTE 3 — the dependency tree is the part benchmarks ignore
**Top comment on Aslam's post, Vincenzo Rubino (verbatim-paraphrase from fetch):** Express has **28
dependencies** with maintenance concerns; Fastify maintains "a much leaner dependency tree." The commenter's
point: **production reliability extends beyond performance benchmarks** — a lean, well-maintained dep tree is a
security and supply-chain advantage that no req/s chart captures.

**turbo lesson (ties to the energy security posture):** when choosing a framework, audit the **transitive
dependency count and maintenance status**, not just throughput. Hono's near-zero-dependency design is a genuine
supply-chain win the benchmarks don't score — and it directly serves the energy "pin security patches" discipline
(ecosystem-11's middleware-CVE wave).

---

## WHERE CREDIBLE SOURCES DISAGREE (verbatim both sides → GAPS-AND-DISPUTES feed)

### DISPUTE 1 — "Which framework should a NEW Node API default to?"
- **Side A (benchmark-first / Hono):** Sohail's data — Hono wins every metric on a realistic load, 37% less
  memory. PkgPulse/adyog: "Hono delivers modern TypeScript-first development with excellent autocomplete."
- **Side B (ecosystem-first / Fastify):** betterstack/pkgpulse synthesis — "Fastify for schema validation,
  serialization, plugin lifecycle, 2-3x faster than Express"; **Fastify's plugin registry covers critical
  production concerns natively** (@fastify/jwt, cors, rate-limit, multipart, swagger). Hono's **"critical
  missing piece is complex session stores and OAuth flows."**
- **Unresolved:** there is no clean winner. The split breaks down by *deployment target* (edge→Hono,
  node-monolith→Fastify) and *feature need* (OAuth/complex-sessions→Fastify today). **GAP:** no source
  benchmarks Hono on Node (not edge) at *extreme* scale — its battle-testing is on Cloudflare Workers, and
  "less battle-tested at extreme scale on Node.js specifically" is a recurring hedge.

### DISPUTE 2 — "Is the framework even your bottleneck?"
- **Side A (it matters):** Aslam/Sohail at scale — framework choice "impacts infrastructure costs
  significantly" above ~100 req/s; 60% cloud-cost deltas claimed.
- **Side B (it doesn't):** the DB-bound convergence data (ecosystem-12; betterstack) — "choosing Fastify over
  Express for a 30% throughput gain on a DB-bound API is rarely worth the migration cost." Bun's own story
  (field-03) shows the same: under a real DB the runtime/framework edge collapses to single-digit %.
- **Reconciliation (the actual answer):** **it depends on where your per-request time goes.** DB-wait-dominated
  → framework is noise. App-layer-JS-dominated (auth, serialization, fan-out) → framework is real money. turbo
  must profile its own request shape before believing either camp.

### DISPUTE 3 — Express 5: "finally modern" vs "still legacy"
- **Side A (use it):** Express 5 shipped async-error auto-forwarding (kills `next(err)` boilerplate) and is
  still actively maintained (last push 2026-06-02, 69K★). For an existing Express codebase, staying is cheap.
- **Side B (move on):** the path-to-regexp v8 wildcard break (ecosystem-11) is a boot-time footgun, the
  dependency tree is heavy (28 deps), and "popular middleware packages may be unmaintained." New code has no
  reason to start on Express in 2026.
- **Consensus-ish:** *don't start new on Express; don't rush to leave a working Express app.* "Express is fine
  and should migrate to Fastify when performance becomes a bottleneck" (betterstack).

---

## THE turbo TAKE (synthesized, with the agent-operator twist)
1. **Default target dictates framework, not benchmarks.** Edge / Cloudflare Workers / multi-runtime → **Hono**
   (matches the energy checklist's stated CF-Workers default). Long-lived stateful Node monolith with rich
   OAuth/session needs → **Fastify** (mature plugins, leanest issue count, leanest deps).
2. **The convergent practitioner architecture is "both by layer"** — not a tribal single-winner pick.
3. **Profile turbo's own request shape** before trusting any RPS claim — DB-bound converges, app-layer-JS-bound
   diverges.
4. **Agent-operator twist:** the dominant human argument *for* Fastify ("team familiarity, smaller learning
   curve" — Sohail) is **near-zero cost for turbo**, which reads docs fresh. So turbo can rationally weight the
   *technical* axes (edge-readiness, type-safety, dep-tree, memory) higher than a human team would, and pick
   Hono more aggressively where the target is edge.
5. **Score the dependency tree as a first-class criterion** (Rubino's taste) — it serves the energy
   security/patch discipline that benchmarks ignore.
