---
title: "turbo GAPS-AND-DISPUTES — Where Sources Disagree, What's Unconfirmed, What turbo Must Settle by Experiment"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [gaps, disputes, unresolved, experiments, both-sides, unconfirmed, backend, runtime]
synthesist: SYNTHESIS / taste-node (CP123 Wave-R)
sources: ["brain/research/raw/field-99-REPORT.md", "brain/research/raw/ecosystem-99-REPORT.md", "brain/research/raw/field-02,03,04,05.md"]
summary: "The honest edges of turbo's knowledge: (A) live DISPUTES where credible sources disagree (both sides verbatim, with turbo's working resolution + the condition that would change it), (B) what could NOT be confirmed this round (the verify-flags), (C) the EXPERIMENTS turbo must run to settle questions no source answers. This file is the intellectual-honesty layer — an expert knows the boundary of what they know."
---

# turbo GAPS-AND-DISPUTES

> **Why this matters.** A brain that only contains settled facts is a brain that will assert confidently where it
> should experiment. This file marks the boundary: the disputes turbo holds an opinion on *but could be wrong*, the
> claims turbo carries *unverified*, and the questions turbo must answer *with its own benchmark/test* because no
> credible source does. When turbo hits one of these, the move is **measure, don't assert** (and write the result
> back to ORG_MEMORY so the gap closes for the fleet).

---

# PART A — LIVE DISPUTES (both sides, with turbo's working resolution)

## DISPUTE A 🔥 — Which framework should a NEW Node API default to? (UNRESOLVED)
- **Side Hono (benchmark / edge / type-first):** swept a realistic production-shaped load (5,618 r/s, 17.4ms avg, 71ms p99, **37% less memory than Fastify**); "modern TypeScript-first, excellent autocomplete." Greenfield default is shifting to Hono-on-(Bun|Workers) (*"new greenfield APIs increasingly built directly on Hono"*).
- **Side Fastify (ecosystem / maturity):** "2-3× faster than Express, plugin lifecycle"; native `@fastify/jwt`, `cors`, `rate-limit`, `multipart`, `swagger`; **Hono's "critical missing piece is complex session stores and OAuth flows."** Lowest open-issue count (150) of the four — a maturity/health signal.
- **The unresolved core:** no clean winner; the split breaks by **deployment target** (edge→Hono, OAuth-heavy-monolith→Fastify) and **feature need** (complex-session/OAuth→Fastify today).
- **turbo's working resolution:** **default Hono** (matches the energy CF-Workers default + the agent-operator twist O-16 — familiarity tax is ~0 for turbo), **escape to Fastify** for a long-lived Node-only monolith with rich OAuth/sessions. (OPINION O-02.)
- **What would change it:** if turbo's surface needs complex OAuth/session stores AND is Node-only-not-edge → flip to Fastify. If a Hono OAuth/session ecosystem matures to Fastify-parity → the escape hatch narrows.
- **THE GAP under it:** **no source benchmarks Hono on *Node* (not edge) at *extreme* scale** — its battle-testing is on Cloudflare Workers; *"less battle-tested at extreme scale on Node.js specifically"* is a recurring hedge with no data behind it. → see EXPERIMENT E-1.
- **Source:** field-02 (DISPUTE 1), field-06 §7.

## DISPUTE B — Is the framework/runtime even your bottleneck? (RESOLVED: "depends where time goes")
- **Side "it matters":** at scale, framework choice *"impacts infrastructure costs significantly"*; 60% cloud-cost deltas claimed (Aslam/Sohail) above ~100 req/s.
- **Side "it doesn't":** DB-bound workloads converge across frameworks AND runtimes (Express ~10K, Fastify ~13K, Hono ~12K r/s; Bun ~3% over Node under a DB); *"choosing Fastify over Express for a 30% throughput gain on a DB-bound API is rarely worth the migration cost."*
- **Resolution:** **it depends on where per-request time goes.** DB-wait-dominated → the framework is *noise*. App-layer-JS-dominated (auth, serialization, fan-out, S3, third-party calls) → the framework is *real money* (this is why Sohail's S3+JWT+DB benchmark showed a wider spread than the pure-DB-bound one).
- **turbo's mandate:** **profile turbo's OWN request shape before believing either camp.** Don't migrate a DB-bound service for a runtime/framework "speed" win. → see EXPERIMENT E-2.
- **Source:** field-02 (DISPUTE 2), field-03, ecosystem-12.

## DISPUTE C — Is Stripe-style date-based versioning worth it? (UNRESOLVED below Stripe scale)
- **Side FOR (Stripe, verbatim):** best caller DX; *"make upgrades as cheap as possible (for users and for ourselves)."* Transformation/version-change modules run changes backwards per request; first request auto-pins the account so users *"don't accidentally receive a breaking change."*
- **Side AGAINST (HN #38950364, verbatim):** *"it seems to me like it's very hard to maintain internally"*; ale_jacques suggests plain git branches/tags; thread summary = *"enthusiasm for the user-facing elegance but significant skepticism about internal maintainability costs — with no commenter actually defending the implementation complexity."* Even Stripe admits *"every new version is more code to understand and maintain."*
- **turbo's working resolution:** **both sides are right at different scales.** Date-based+transforms is gold at many-external-integrators scale; URL-path `/v1` (or additive-only, no versioning) is the right-sized choice for a small/internal/agent-built API (OPINION O-10).
- **THE GAP / the finding itself:** **there is NO public, credible "we adopted Stripe-style date versioning at *small* scale and it paid off" report.** Every defender is at Stripe/GitHub scale. That asymmetry IS the finding — answerable only by reasoning (default to `/v1`), not by a citation.
- **Source:** field-04, ecosystem-04.

## DISPUTE D — Is Bun production-ready? (RESOLVED: workload-specific, not yes/no)
- **Side YES:** ~95-98% Node compat, *"thousands of companies in production,"* a gaming studio went 8→5 servers clean (WS-fan-out), Bun.Image (2026-05-13) killed the sharp blocker.
- **Side NO/CAUTION:** 72h memory leaks (a team **rolled BACK** to Node LTS); `node:inspector`/APM/PM2 gaps; *"mostly compatible is not a word you want on the critical path for payments."* 7,087 open issues.
- **Resolution:** **GREEN** for CLIs/test/edge/WS-no-native-addons; **YELLOW** (soak ≥72h) for always-on; **RED** for native-gyp/payments-grade/PM2/inspector. A per-workload call, not a verdict. (OPINION O-05.)
- **What would change it:** Bun closing the inspector/APM/PM2/long-uptime-GC gaps (each is actively worked) moves more workloads from RED/YELLOW to GREEN. Re-check quarterly.
- **Source:** field-03, ecosystem-06.

## DISPUTE E — Express in 2026: modern-enough vs legacy? (CONSENSUS-ish)
- **FOR:** Express 5 added async-error auto-forwarding (kills `next(err)` boilerplate); still actively maintained (69K★, last push 2026-06-02). For an *existing* Express app, staying is cheap.
- **AGAINST:** path-to-regexp v8 wildcard boot-break; 28-dep tree with maintenance concerns; greenfield should not start on Express.
- **Resolution (consensus-ish):** ***"don't start new on Express; don't rush to leave a working one."*** Migrate to Fastify *when* performance/correctness becomes a real bottleneck — not reflexively.
- **Source:** field-02 (DISPUTE 3), field-06.

## DISPUTE F (synthesist-flagged, lower-heat) — `@hono/zod-validator` vs `@hono/standard-validator`
- **Side standard:** binds validators through Standard Schema → Zod↔Valibot is a package swap, no route-code change (future-proofs the validator choice).
- **Side zod-specific:** `@hono/zod-validator` is *"still fine and slightly more featureful for Zod"* — better ergonomics if you've committed to Zod.
- **turbo's resolution:** default **Standard-Schema-bound** *when swappability is wanted* (bundle-critical surfaces that might move to Valibot); **`@hono/zod-validator`** when you want Zod-specific ergonomics and won't swap. Low-stakes — both work; it's a hedge-vs-ergonomics trade, not a correctness one.
- **Source:** ecosystem-03 (noted as a routing choice, not a hard dispute — flagged here for completeness).

---

# PART B — WHAT COULD NOT BE CONFIRMED (verify-flags; carry as unverified)

## Gap-1 ⚠️ — Vercel's CURRENT minimum Node version (post-Node-20-EOL)
The checklist says "Vercel needs Node 20.9+," but Node 20 reached EOL 2026-04-30. **Confirmed:** Node 20 is dead, 24 is LTS. **NOT confirmed:** what Vercel's build min is *today* (whether they bumped to 22 and deprecated 20 builds — they deprecated Node 18 builds in 2025, so 20-deprecation likely follows EOL but wasn't verified from Vercel's own docs).
**Action for turbo:** `curl`/check the vercel.com/docs runtimes page at build time before pinning the `engines` field. Don't assume. (Source: ecosystem-99.)

## Gap-2 ⚠️ — Exact `@hono/zod-openapi` v0.x→v1.0 breaking changes
**Confirmed:** it reached **v1.4.0** (the OpenAPI stack stabilized — a meaningful milestone). **NOT pulled:** the v0.x→v1.0 migration notes/changelog — so the exact breaks for repos still on 0.x (like `w3cj/hono-open-api-starter`, last pushed Oct 2025) are unenumerated.
**Action for turbo:** fetch the `@hono/zod-openapi` v1.0 release notes before adopting the starter wholesale. (Source: ecosystem-99. → SCENARIO S-10.)

## Gap-3 ⚠️ — Apples-to-apples Hono vs Express vs Fastify benchmark on the SAME hardware
Hono's own benchmark page gives Hono-vs-edge-router numbers (402k ops/sec Workers, 136k req/sec Deno) but **explicitly omits direct Express/Fastify comparison rows.** The framework-speed claims rest on Hono's relative numbers + single-author practitioner blogs (Sohail/Aslam), whose absolute RPS numbers are **not independently reproduced** (field-02 flags the synthetic-vs-DB-bound spread explicitly).
**Action for turbo:** if a perf decision hinges on it, run an in-repo benchmark on turbo's own request shape — don't trust marketing pages or un-reproduced blog numbers. (Source: ecosystem-99, field-99. → EXPERIMENT E-1/E-2.)

## Gap-4 — Bun acquisition by Anthropic (RESOLVED to confirmed, was a session-gap)
**Status note:** the field-03/ecosystem-06 files flagged the Anthropic-acquires-Bun lead as *"could not independently confirm from a primary announcement within this session."* The ecosystem-99 REPORT then **confirmed it** with primary sources (anthropic.com/news/anthropic-acquires-bun…, bun.com/blog/bun-joins-anthropic, redmonk 2026-06-04, HN #46124258) — Nov/Dec 2025, tied to Claude Code's $1B run-rate, stays MIT/OSS. **So this gap is closed**; recorded here only because two raw files left it open and a future reader of those files needs the resolution. Strategic relevance: first-party runtime alignment for an Anthropic-aligned platform. (Source: ecosystem-99.)

## Gap-5 ⚠️ — Live X/Twitter practitioner temperature on Hono/Bun/Fastify (UNAVAILABLE — tooling, not soul-loss)
The authenticated session (`~/.claude/x-auth/x-session.json`, cookies loaded) works, but `energy/scripts/x-content-intel/scrape.py` hit **HTTP 404** on X's GraphQL search endpoint (stale rotating query-ID). Both researchers fell back to HN + GitHub (`gh api` live stats) + dated blogs — higher-signal and citable anyway.
**Action if needed:** refresh the GraphQL query-ID in the energy script, or use `bb` (Browse CLI) against x.com search. **Not a blocker** — the HN/GitHub/blog corpus covers the framework/runtime taste. (Source: field-99, field-05.)

## Gap-6 — Second-hand quotes (corroborated, but not directly fetched)
- The Register memory-leak article (2026-04-21) is real per WebSearch but its canonical URL 404'd on direct fetch (URL-mangling); the leak facts are corroborated by buildmvpfast/tech-insider, so the claim stands, but the verbatim Register quotes are second-hand via search summary.
- The "category reports got items from other categories" repro (War Story 1) is from a **2018 Tensult post** — old, but the mechanism is unchanged and it's paired with the 2026 Fluid amplification. Treat the *mechanism* as current; the *date* as illustrative-canonical.
(Source: field-99.)

---

# PART C — EXPERIMENTS turbo MUST RUN (no source answers these; measure, don't assert)

These are the questions where the honest answer is *"run it and find out."* When turbo faces one, it runs the experiment and **writes the result back to ORG_MEMORY** so the fleet inherits a fact, not a gap.

## E-1 — Hono-on-Node at high load (close Gap-3 / DISPUTE A's gap)
- **Question:** does Hono's edge-proven throughput hold on a *heavy Node service* (not edge), at the scale where the "less battle-tested on Node" hedge lives?
- **Method:** `autocannon`/`k6` against turbo's own Hono-on-`@hono/node-server` service AND a Fastify equivalent, same hardware, same realistic route (auth + Zod-validate + DB-insert), 100+ concurrent, ≥60s. Compare r/s, p99, memory.
- **Writes back:** the apples-to-apples number no public source provides. Until then, DISPUTE A's resolution is "default Hono" by *portability+type-safety*, not by a verified Node-at-scale throughput claim.

## E-2 — turbo's own request-shape profile (settle DISPUTE B for turbo specifically)
- **Question:** where does turbo's per-request time actually go — DB wait, or app-layer JS (auth/serialization/fan-out)?
- **Method:** flame-graph / span-timing a representative turbo endpoint. If DB-wait dominates → framework/runtime choice is noise (don't optimize it). If app-layer-JS dominates → framework choice is real money (Hono/Fastify pull ahead of Express).
- **Writes back:** the single fact that tells turbo whether to *ever* care about framework throughput. The default assumption (per DISPUTE B) is DB-bound = noise; *verify it* before any perf-driven framework decision.

## E-3 — Bun 72h soak (before ANY always-on Bun deploy)
- **Question:** does turbo's specific always-on workload leak under Bun over multi-day uptime (the Story-C/D failure class)?
- **Method:** run the service under Bun ≥72h with production-like load + memory monitoring; compare RSS trajectory to the same service on Node 24. Pin the Bun version.
- **Writes back:** GREEN/YELLOW/RED for *this* workload on Bun. CI + a 1-hour load test are NOT sufficient evidence (the leaks surface at 72h). This is a hard gate, not optional (OPINION O-05).

## E-4 — Native `.ts` codebase scan (before adopting build-less deploy)
- **Question:** does turbo's code use any construct native type-stripping breaks (`enum`, value-`namespace`, decorators, runtime `paths` reliance)?
- **Method:** grep + a `node --experimental-strip-types` smoke-run + the `tsc --noEmit` gate. If clean → adopt build-less Node-24 deploy. If not → refactor (enums→`as const` unions; `paths`→project references) first.
- **Writes back:** whether turbo can run build-less, and the refactors needed. The `tsc --noEmit` CI gate stays regardless (OPINION O-09).

## E-5 — `@hono/zod-openapi` v1 upgrade diff (close Gap-2 before scaffolding from the starter)
- **Question:** what breaks when bumping the reference starter from `@hono/zod-openapi` 0.x → 1.4.0?
- **Method:** fetch the v1.0 release notes; bump in a branch; run the starter's Vitest suite; fix the breaks; record them.
- **Writes back:** the v0→v1 migration checklist for the starter — turning SCENARIO S-10's "bump before use" from a warning into a known procedure.

---

## The intellectual-honesty stance (carry this)
**An expert knows the boundary of what they know.** turbo holds opinions (PART A resolutions, OPINIONS.md) but each names the condition that would flip it. turbo carries unverified claims (PART B) explicitly flagged, not laundered into facts. And turbo answers the unanswerable (PART C) by *measuring*, then writing the result back to ORG_MEMORY so the gap closes for every future workflow. The anti-pattern is confident assertion where the source corpus is silent or split — when in doubt, this file says **run the experiment.** (synthesist; grounded in field-99 + ecosystem-99 explicit gap lists)
