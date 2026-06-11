---
title: "Migration War Stories — A→B, What Actually Broke (and the tRPC Plot Twist) (June 2026)"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [migration, express, fastify, trpc, orpc, rest, war-stories, incremental-migration]
sources:
  - "blog.val.town/blog/fastify — Tom MacWright, 2024-07-02 (fetched 2026-06-11)"
  - "infoq.com/news/2025/12/orpc-v1-typesafe — oRPC v1.0, 2025-12-19 (fetched 2026-06-11)"
  - "github.com/fastify/fastify-express (compat layer, fetched 2026-06-11)"
  - "WebSearch synthesis: pkgpulse, dev.to/whoffagents, pockit, Rahul Kaklotar (Medium 2026-04) 2026"
related: ["[[field-02-framework-taste-and-disputes]]", "[[field-04-api-versioning-regrets]]", "[[ecosystem-04-api-design]]"]
summary: "What actually breaks in real A→B moves. Express→Fastify: the ONLY safe path is incremental via @fastify/express wrap (Val Town did it PR-by-PR); the killers are error-middleware→hooks and Express-only packages (legacy payments) with no Fastify equiv. THE PLOT TWIST: the hypothesis 'people regret tRPC and flee to REST' is FALSE in 2026 — nobody's fleeing; they're adopting oRPC (1.6x faster type-check, native OpenAPI) and converging on a layered REST-public/RPC-internal architecture. Honest 'expected-vs-found' captured."
---

# Scope note
This file is the **A→B migration** layer. field-02 covers framework *taste*; field-04 covers *versioning*
regrets. Here: what broke when teams actually moved, with the blast radius and the safe path.

---

## WAR STORY — Express → Fastify, the incremental wrap (the canonical safe migration)
**Source:** Tom MacWright (Val Town), 2024-07-02. The clearest real account; flagged ~2yr old but the
mechanism + `@fastify/express` path is unchanged and corroborated by 2026 sources.

### Why they left Express (verbatim reasons)
1. **The OpenAPI spec was dead.** They had a public API with an OpenAPI spec but it was _"just a dead document,
   a YAML file"_ not enforced in code — _"the spec and actual implementation could (and did) diverge."_
   **(This is the same disease as field-04's 17%-contract-testing gap — a spec with no enforcement is theater.)**
2. **Express predates async/await and _"does not mix well with them."_** Plugins like `express-async-errors`
   felt _"bolted-on"_ rather than idiomatic.

### How they migrated (the safe pattern, verbatim)
> "the first fastify PR just added the fastify dependency and wrapped our express server with fastify. Then each
> successive PR moved a few routes from express to fastify."

Via the **`@fastify/express`** adapter → **no development freeze, parallel feature work continued.** This is the
gold-standard incremental migration shape: wrap, then strangle route-by-route (Strangler Fig).

### Why Fastify specifically (verbatim advantages)
First-party plugin quality, native async/await, built-in validation+serialization, strong OpenAPI integration,
**out-of-the-box OpenTelemetry + Sentry**, and `light-my-request` testing _"maintained by Fastify's team."_
**Note (verbatim):** _"No performance metrics were provided. The author noted web framework overhead wasn't
their bottleneck anyway."_ — i.e. they moved for **DX + correctness + observability**, NOT speed. (Reinforces
field-02 DISPUTE 2: the framework is rarely your bottleneck.)

### The gotchas that bite this migration (2026 corroboration)
- **Error handling model differs:** _"Fastify uses hooks instead of error middleware."_ Express error-middleware
  (`(err, req, res, next)`) has no 1:1 Fastify equivalent — rewrite as `setErrorHandler` / hooks.
- **`@fastify/express` is a BRIDGE, not a destination (verbatim):** _"should not be used as a long-term
  solution... Express does not support Node.js core HTTP/2, so this plugin does not support HTTP/2 either."_
  Leaving the wrap in place permanently forfeits HTTP/2 and Fastify's perf.
- **THE landmine (verbatim):** _"audit every middleware and plugin you're using, as some Express-specific
  packages have no direct Fastify equivalent, and discovering that mid-migration is painful."_ Specifically
  called out: _"legacy payment integrations may have no Fastify alternative."_ **Audit deps BEFORE you start.**

**turbo lesson:** any framework migration must be (1) incremental behind a compat wrap, (2) preceded by a
dependency audit for no-equivalent packages, and (3) justified by DX/correctness/observability, not a benchmark.

---

## THE PLOT TWIST — "people regret tRPC and flee to REST" is FALSE in 2026
**Honest expected-vs-found** (the mission asks for taste + disputes; this is a hypothesis that died on contact
with evidence — which is itself a finding worth recording).

- **Expected:** searching "migrated FROM tRPC / regret tRPC" would surface flight-from-tRPC war stories.
- **Found (verbatim synthesis):** _"The search results predominantly show migrations TOWARD tRPC from REST, not
  away from it... the narrative in 2025-2026 appears to be stabilization (v11 released early 2026) rather than
  regret-driven migrations away from it."_ Switching tRPC→REST is _"doable since it's HTTP underneath,"_ but
  _"you lose type propagation in the process"_ — so few do.

### What's ACTUALLY happening instead: the oRPC rise + the layered consensus
**Source:** InfoQ, oRPC v1.0, 2025-12-19. The real 2026 movement isn't away from typed-RPC — it's toward a
**better** typed-RPC that fixes tRPC's OpenAPI gap.
- **oRPC v1.0 (verbatim claims vs tRPC):** _"1.6 times faster type checking,"_ _"2.8 times faster runtime
  performance,"_ bundle _"roughly half that of tRPC's,"_ memory _"103MB compared to tRPC's 268MB."_
- **The key differentiator (verbatim):** _"Unlike competing solutions that require third-party plugins or have
  deprecated OpenAPI support, oRPC builds OpenAPI adherence directly into its core."_ A quoted dev: _"the key
  differentiator is oRPC's built-in OpenAPI support, which server actions cannot provide."_ Plus _"Cloudflare
  WebSocket hibernation"_ and _"typesafe file handling"_ (edge-native — relevant to turbo's CF-Workers default).
- **The dominant 2026 architecture (verbatim):** _"public REST APIs with OpenAPI serve external developers,
  internal tRPC/GraphQL serves your own TypeScript frontend, and gRPC/REST handles service-to-service."_

**turbo lesson:** don't frame the choice as "tRPC vs REST." The 2026 consensus is **layered: REST/OpenAPI at the
public edge, typed-RPC internally.** And if turbo wants typed-RPC, **oRPC is the 2026 pick over tRPC** when
OpenAPI output or edge/CF-Workers matters (it natively does both; tRPC needs plugins). This also corroborates
ecosystem-04's note that oRPC handles rich types (Date) natively where tRPC/plain-JSON drops them (ecosystem-11
#1800).

---

## SMALLER MIGRATION NOTES (field-corroborated)
- **Express 4→5 (in-place "migration"):** _"not a drop-in replacement... introduces breaking changes that can
  catch teams off guard"_ — the path-to-regexp v8 wildcard rename is the boot-time killer (ecosystem-11). Treat
  a v4→v5 bump as a migration, not a patch.
- **"Productive within a day" (verbatim):** for Express→Fastify, _"the API structure is similar enough for
  developers to become productive within a day"_ — the *learning* curve is gentle; the *dependency-equivalence*
  curve is the risk. The cost is in the no-equivalent packages, not the syntax.
- **Phased/new-endpoints-in-B pattern:** _"new endpoints are developed in Fastify and existing routes gradually
  migrated"_ — the same Strangler-Fig shape Val Town used. This is the only pattern with a clean rollback.

---

## X / TWITTER SIGNAL — SKIPPED (tooling failure, documented)
Per mission instruction, attempted live X signal via `energy/scripts/x-content-intel/scrape.py` with the
authenticated session at `~/.claude/x-auth/x-session.json` (cookies present and loaded). **Result: X's internal
GraphQL search endpoint returned HTTP 404** — the query-ID baked into the script is stale (X rotates GraphQL
query IDs; the energy memory notes GraphQL > Chrome-renderer but the IDs drift). Two `--search` attempts → 0
tweets. **Decision:** rely on HN (Stripe versioning thread, Bun #27664), GitHub issues (gh api live stats), and
dated practitioner blogs — all of which are higher-signal and citable than X anyway. Logged as a known gap, not
a soul-loss; the HN/GitHub/blog corpus more than covers the framework/runtime taste this file needed.

---

## THE turbo TAKE (migration discipline)
1. **Never big-bang a framework migration.** Wrap (`@fastify/express`-style) and strangle route-by-route; keep
   feature work flowing. Val Town is the template.
2. **Dependency audit BEFORE you start** — the killer is a no-Fastify-equivalent package (legacy payments)
   discovered mid-flight. List every middleware/plugin; confirm an equivalent exists.
3. **Migrate for correctness/DX/observability, not speed** — every honest migration story (Val Town, field-02's
   Sohail) says the framework wasn't the bottleneck.
4. **For the API layer, go layered, not tribal:** REST/OpenAPI public, typed-RPC internal. If typed-RPC,
   **prefer oRPC over tRPC in 2026** for native OpenAPI + edge/CF-Workers + rich types.
5. **A v4→v5 major bump is a migration** (Express path-to-regexp) — read the migration guide, don't treat it as
   `npm update`.

> One-line taste: **Every good migration is a Strangler Fig (wrap, then route-by-route) justified by correctness,
> not benchmarks — and in 2026 the API-layer story isn't "tRPC vs REST," it's "REST at the edge, oRPC inside."**
