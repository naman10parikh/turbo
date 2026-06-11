---
title: "Field Intelligence — Final Report, Top Findings & GAPS-AND-DISPUTES Feed (turbo, June 2026)"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [field-intelligence, report, gaps, disputes, backend, runtime, summary]
researcher: FIELD-INTELLIGENCE (CP123 Wave-R)
sources: ["see per-file frontmatter in field-01..field-06; ~28 distinct primary sources"]
related: ["[[field-00-INDEX]]"]
summary: "Synthesis of the field-* corpus: the practitioner/hard-won-lessons layer for turbo's backend/runtime domain. Top findings, the verbatim disputes that feed GAPS-AND-DISPUTES, and what could NOT be confirmed."
---

# Field Intelligence — Final Report (turbo backend/runtime, June 2026)

## What this corpus is
The **lived-experience** layer complementing the `ecosystem-*` state-of-the-art layer. Six content files:
postmortems (field-01), framework taste+disputes (field-02), Bun prod war stories (field-03), versioning regrets
(field-04), migration war stories (field-05), and the 2026-invalidates-2025 inversions (field-06). Every claim
is cited with URL + date + (for HN/forum) author; sources <6 months old preferred, older ones flagged.

## The single most load-bearing finding (for the energy law)
**The energy `new Map()` law is MORE right in 2026, but its stated mechanism is now only half the story.** Vercel
**Fluid Compute is default-on** and ended one-request-per-instance isolation, so module-level state is unsafe for
a *second* reason: not just "empty on cold start" but "**shared & racy across concurrent requests on one warm
instance.**" The taste quote that captures it (getautonoma, verbatim): _"This is not a Fluid Compute bug; it is a
pre-existing code smell that isolation was hiding."_ → **Action for turbo:** the law stays; update its *reason* to
cover warm-concurrency, and add the field-01 grep recipe to any Vercel-route review. (field-01, field-06 §4)

---

## TOP 10 FINDINGS (one line each)
1. **Fluid Compute inverted the serverless-state risk** — module singletons are now concurrently shared/racy on
   warm instances; the `new Map()` law now has two justifications, not one. (field-01)
2. **Vercel's own Fluid announcement is silent on the state hazard** — "no explicit guidance on module-level
   variables under concurrency"; the foot-gun is left for third parties to document. (field-01)
3. **Native TS type-stripping (Node 24 default) gives ~9× faster cold starts (1.4s→sub-200ms) but does NOT
   type-check** — turbo now *requires* a separate `tsc --noEmit` CI gate to keep the energy "no any" law. (field-06 §1)
4. **Node 22+ killed a dependency class** (fetch/test/glob/uuid stable; dotenv/sqlite/ws-server still
   experimental) — drop the stable ones for supply-chain safety; keep deps for the experimental gaps. (field-06 §2)
5. **The framework benchmark winner ≠ what practitioners ship** — Hono swept a realistic benchmark (5,618 r/s,
   98MB) yet the author shipped Fastify for "team familiarity"; two independent practitioners converge on
   "Fastify monolith + Hono edge," not a single winner. (field-02)
6. **The framework is rarely your bottleneck** — under a real DB the three converge (~10-13K r/s); every honest
   migration (Val Town) moved for DX/correctness/observability, not speed. (field-02, field-05)
7. **Bun's #1 historical blocker (sharp/node-gyp) fell to Bun.Image (May 13 2026)** — but node:inspector, APM,
   PM2, and 72h-uptime GC leaks remain; one team rolled BACK to Node LTS over memory leaks. (field-03, field-06 §5)
8. **Bun's green-light profile is narrow & specific** — CLIs/test-runner/edge/WS-fan-out-without-native-addons
   (a gaming studio went 8→5 servers, clean); RED for heavy node-gyp, payments-grade, PM2-dependent, always-on. (field-03)
9. **60% of teams version APIs but only 17% contract-test** — most make the stability *promise* without the
   *enforcement*; versioning without Zod-enforced contracts is theater. (field-04)
10. **The "tRPC vs REST" framing is dead** — nobody's fleeing tRPC; the 2026 move is to **oRPC** (native OpenAPI,
    1.6× type-check, ½ bundle, edge/CF-Workers) inside a **layered** REST-public/RPC-internal architecture. (field-05, field-06 §6)

---

## GAPS-AND-DISPUTES FEED (verbatim both sides — for the GAPS-AND-DISPUTES doc)

### DISPUTE A — Which framework should a NEW Node API default to? (UNRESOLVED)
- **Side Hono (benchmark/edge/type-first):** swept a realistic load (37% less memory than Fastify); "modern
  TypeScript-first, excellent autocomplete." Greenfield default is shifting to Hono-on-(Bun|Workers).
- **Side Fastify (ecosystem/maturity):** "2-3× faster than Express, plugin lifecycle"; native @fastify/jwt,
  cors, rate-limit, multipart, swagger; **Hono's "critical missing piece is complex session stores and OAuth
  flows."** Lowest open-issue count (150) of the four.
- **Status:** no clean winner; splits by deployment target (edge→Hono, OAuth-heavy-monolith→Fastify). **GAP:**
  no source benchmarks Hono on *Node* (not edge) at *extreme* scale — its battle-testing is on CF Workers.

### DISPUTE B — Is the framework/runtime even your bottleneck? (RESOLVED: "depends where time goes")
- **Side "it matters":** at scale, framework choice "impacts infrastructure costs significantly"; 60% cloud-cost
  deltas claimed (Aslam/Sohail).
- **Side "it doesn't":** DB-bound workloads converge across frameworks AND runtimes (Bun ~3% over Node under DB);
  "rarely worth the migration cost" for a 30% gain.
- **Resolution:** DB-wait-dominated → framework is noise; app-layer-JS-dominated (auth/serialization/fan-out) →
  framework is real money. **turbo must profile its own request shape.**

### DISPUTE C — Is Stripe-style date-based versioning worth it? (UNRESOLVED below Stripe scale)
- **Side FOR (Stripe, verbatim):** best caller DX; "make upgrades as cheap as possible." Transformation modules
  run changes backwards per request.
- **Side AGAINST (HN, verbatim):** "very hard to maintain internally"; ale_jacques suggests plain git
  branches/tags; **"no commenter actually defended the implementation complexity."** Even Stripe admits "every
  new version is more code to maintain."
- **GAP:** no credible "we did Stripe-style date versioning at *small* scale and it paid off" report exists — the
  defenders are all at Stripe/GitHub scale. The asymmetry is the finding.

### DISPUTE D — Is Bun production-ready? (RESOLVED: workload-specific)
- **Side YES:** ~98% Node compat, "thousands of companies in production," gaming studio 8→5 servers clean,
  Bun.Image killed the sharp blocker.
- **Side NO/CAUTION:** 72h memory leaks (a team rolled back to Node LTS); node:inspector/APM/PM2 gaps; "mostly
  compatible is not a word you want on the critical path for payments." 7,087 open issues.
- **Resolution:** GREEN for CLIs/test/edge/WS-no-native-addons; RED for always-on/native-gyp/payments/PM2. Not a
  yes/no; a per-workload call. (field-03 has the full matrix.)

### DISPUTE E — Express in 2026: modern-enough vs legacy? (CONSENSUS-ish)
- **FOR:** Express 5 added async-error auto-forwarding; still maintained (69K★). Don't rush to leave a working app.
- **AGAINST:** path-to-regexp v8 wildcard boot-break; 28 deps; greenfield should not start on Express.
- **Resolution:** "don't start new on Express; don't rush to leave a working one."

---

## THREE THINGS I COULD NOT CONFIRM (for GAPS-AND-DISPUTES)
1. **Live X/Twitter signal — UNAVAILABLE (tooling, not soul-loss).** The authenticated session
   (`~/.claude/x-auth/x-session.json`, cookies present + loaded) works, but `energy/scripts/x-content-intel/
   scrape.py` hit **HTTP 404** on X's GraphQL search endpoint (stale rotating query-ID). Two `--search` attempts
   → 0 tweets. Fell back to HN + GitHub (`gh api` live stats) + dated blogs per mission instruction — higher
   signal and citable anyway. **GAP:** no fresh practitioner-X temperature on Hono/Bun/Fastify; if needed,
   refresh the GraphQL query-ID in the energy script or use `bb` against x.com search (not attempted to stay in
   scope/time).
2. **Hono at extreme scale on Node (not edge) — UNVERIFIED.** Every Hono benchmark/battle-test cited runs on
   Cloudflare Workers or a small node test. The recurring hedge "less battle-tested at extreme scale on Node.js
   specifically" appears in multiple sources but **no source provides the missing high-load-Node-Hono data.**
   This is a genuine open question for turbo if it ever runs Hono on a heavy Node service rather than edge.
3. **Stripe-style date versioning at small/agent scale — NO EVIDENCE EITHER WAY.** Confirmed it's gold at
   Stripe/GitHub scale and that HN skeptics doubt it below that, but found **zero** primary reports of a
   small team or agent-built API adopting transformation-module date-versioning and reporting the outcome. The
   "is it over-engineering for turbo?" question is answerable only by reasoning (field-04 says yes, default to
   URL-path `v1`), not by a citation.

### Minor secondary unknowns (noted, lower priority)
- The Register memory-leak article (2026-04-21) is real per WebSearch but its canonical URL 404'd on direct
  fetch (URL-mangling); the leak facts are corroborated by buildmvpfast/tech-insider, so the claim stands, but
  the verbatim Register quotes are second-hand via search summary, not a direct fetch.
- Several practitioner blogs (Sohail, Aslam) are single-author Medium/dev.to benchmarks — directionally useful
  and quoted as *taste*, but their absolute RPS numbers are not independently reproduced; field-02 flags the
  reconciliation explicitly (synthetic-vs-DB-bound spread).

---

## SOURCES COUNT
**~28 distinct primary/secondary sources** across the six files (see per-file frontmatter for the full list).
Breakdown: 1 internal law (energy typescript.md, read-only) · 3 Vercel primary (Scale-to-one blog, Fluid docs,
cold-start discussions) · 2 GitHub-via-gh-api live stat pulls (4 framework repos + Bun) · 1 HN thread (Stripe
versioning #38950364) · 1 Stripe Engineering blog + docs · 2 Bun-specific primaries (omidsaffari Bun.Image, The
Register via search) · 1 InfoQ (oRPC v1.0) · 1 Val Town migration blog · 2 Node-native primaries (hirenodejs
type-stripping, nodesource feature table) · 1 Postman State-of-API stat · ~11 dated 2026 practitioner blogs/
comparison guides (byteiota, betterstack, pkgpulse, digitalapplied, getautonoma, bolderapps, dev.to authors,
etc.) cited as taste/synthesis with reconciliation flags.

**Currency:** the large majority are <6 months old (Dec 2025–June 2026). Older-but-still-valid sources are
explicitly flagged in-file: Tensult Lambda-globals (2018, canonical mechanism, paired with 2026 amplification),
Val Town Fastify migration (2024-07, mechanism unchanged + 2026-corroborated). No undated marketing pages used
as load-bearing evidence.

## HANDOFF NOTE (for the turbo brain / GAPS-AND-DISPUTES doc author)
- The five verbatim disputes above (A–E) are pre-formatted for direct lift into GAPS-AND-DISPUTES.
- The three unconfirmed items are the gaps to either close (refresh X query-ID; find high-load-Node-Hono data;
  find small-scale date-versioning report) or accept as reasoned-not-cited.
- field-06's "adopt the inversion, read the asterisk" is the single most reusable taste for turbo's
  decision-making; the per-inversion fine-print is the part an over-eager agent will skip.
