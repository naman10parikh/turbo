---
title: "Field Intelligence — Backend/Runtime (turbo) — INDEX"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [field-intelligence, postmortems, taste, disputes, migration, backend, runtime]
researcher: FIELD-INTELLIGENCE (CP123 Wave-R)
summary: "Hard-won practitioner lessons for turbo's backend/runtime domain: production postmortems, migration war stories, explicit taste (quoted), credible disagreements (both sides verbatim), and the 2026 changes that invalidate 2025 conventional wisdom. Complements the ecosystem-* files (state-of-the-art / what-to-use) with the field layer (what-bit-people / what-they-believe)."
---

# turbo — FIELD INTELLIGENCE INDEX (June 2026)

Researcher: FIELD-INTELLIGENCE (CP123 Wave-R). This corpus is the **practitioner / hard-won-lessons** layer.
The sibling `ecosystem-*` files already cover the state-of-the-art ("what to use, how it bites at the issue
level"). These `field-*` files go one layer deeper into **lived experience**: full postmortems (not one-line
cites), provider-migration blast radii, explicit TASTE held by great engineers (quoted), where credible sources
DISAGREE (both sides captured verbatim → feeds GAPS-AND-DISPUTES), and the specific **2026-invalidates-2025**
inversions.

## The law this domain serves (quoted, read-only, from energy)
`~/energy/.claude/rules/typescript.md` line 13:
> "NEVER use `new Map()` for cross-request state in Vercel API routes (`app/api/`). Each request may hit a cold
> Lambda with empty state. Use external stores (Supabase, Upstash) or pass IDs from client."

The field research below **strengthens and updates** this law (see field-01): in 2026 Vercel's **Fluid Compute
is default-on**, so module-level state is unsafe for a *second* reason — not just "empty on cold start" but now
"**shared & racy across concurrent requests on one warm instance**." The law's intent is more right than ever;
its *stated mechanism* is now only half the story.

## Files in this corpus
- field-00-INDEX.md (this file)
- field-01-serverless-state-coldstart.md — the `new Map()` bug class, Fluid Compute inversion, real postmortems
- field-02-framework-taste-and-disputes.md — Hono/Fastify/Express: receipts + quoted taste + where experts disagree
- field-03-bun-prod-warstories.md — when Bun is actually safe in prod; the migration postmortems with blast radius
- field-04-api-versioning-regrets.md — versioning war stories, what people regret, Stripe's model vs the backlash
- field-05-migration-warstories.md — provider/framework A→B: what actually broke (Express→Fastify, REST→tRPC→back, etc.)
- field-06-2026-invalidates-2025.md — the conventional-wisdom inversions of the last ~12 months
- field-99-REPORT.md — synthesis, top findings, GAPS-AND-DISPUTES feed, sources count

## How these differ from ecosystem-*
| Axis | ecosystem-* | field-* |
| --- | --- | --- |
| Question | "what's the current best tool/version?" | "what bit people / what do great engineers believe?" |
| Evidence | changelogs, version tables, issue symptom→fix | full postmortems, migration blast radius, quoted opinion |
| Output | a recommendation | a warning + a taste + a dispute |
| Overlap policy | owns the matrix | cites the matrix, never re-derives it |

No file here re-derives a version table or a tradeoff matrix already in `ecosystem-*`. When a fact is shared,
this corpus **cites** the ecosystem file and adds the lived-experience layer on top.
