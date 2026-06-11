---
title: "Edge Runtimes — Cloudflare Workers vs Vercel Functions (June 2026)"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [edge, cloudflare-workers, vercel, runtime, cold-start, nodejs-compat]
sources:
  - "WebSearch: CF Workers vs Vercel Edge 2026 (kunalganglani, morphllm, propicked, digitalapplied)"
  - "energy/audit/HARNESS-CHECKLIST-2026.md line 289 (Cloudflare Agents Week, Durable Objects/Sandboxes GA)"
summary: "Workers = V8 isolates, <5ms cold, 330+ PoPs, but Web-API subset (nodejs_compat covers most). Vercel = Edge Runtime (V8, 50-250ms cold) OR Node Serverless (200-800ms cold). Workers limits: 128MB RAM, 30-50ms CPU. Hono runs on both unmodified — that's why it's the default."
---

# Why this matters for turbo
turbo is a backend/runtime harness whose product surfaces deploy to BOTH Vercel (web, per energy
auto-deploy-on-push rule) AND Cloudflare (edge/services, per checklist line 289). The runtime model differs
sharply between them, and **Hono is the bridge** — the same Hono app runs on Node-Vercel, Edge-Vercel, and
Workers without code changes. This file is the map of what's actually different.

## The two runtime families
| | **Cloudflare Workers** | **Vercel Edge Functions** | **Vercel Node Serverless** |
|---|---|---|---|
| Engine | **V8 isolates** (no container/VM) | V8 isolates (Edge Runtime) | Node.js in a Lambda |
| Cold start | **<5ms** (isolate init) | 50–250ms | 200–800ms |
| API surface | **Web-API subset** (no `fs`/`net`/`child_process` natively) | Web-API subset (browser/V8-ish) | full Node.js |
| Node compat | **`nodejs_compat` flag** covers most npm | limited | full |
| Memory | **128MB** cap | limited | up to GBs |
| CPU time | **30–50ms** per request (paid 30M CPU-ms/mo) | limited | generous |
| PoPs / regions | **330+ cities** | ~100 edge regions | regional |
| Pricing entry | Free 100k req/day; $5/mo = 10M req | bundled w/ Vercel | bundled w/ Vercel |

(Source: kunalganglani, morphllm, digitalapplied 2026 — WebSearch 2026-06-11.)

## The decisive constraints (what bites)
1. **Workers has NO native Node APIs.** Anything assuming `fs`, `net`, `child_process`, raw TCP, or native
   addons fails. The **`nodejs_compat`** compatibility flag (set in `wrangler.toml`) polyfills *most* of Node's
   surface in 2026, but not all. **turbo rule:** code to **Web standards** (Fetch, Web Streams, Web Crypto) so
   the same handler runs on Node AND Workers — Hono enforces this naturally.
2. **128MB RAM + 30–50ms CPU on Workers.** Heavy compute (image processing, big in-memory transforms, large
   JSON) does NOT belong in a Worker. Push it to a Node service / queue / Durable Object / Cloudflare Sandbox.
3. **`new Map()` is doubly wrong at the edge.** The energy law already bans `new Map()` for cross-request state
   on Vercel cold Lambdas. On Workers it's worse: each request can hit a **different isolate on a different PoP**,
   so module-level state is non-deterministic across the globe. Cross-request state MUST be **Workers KV /
   Durable Objects / D1 / external Upstash** — never module memory. (This is exactly echo's rate-limit/cache
   territory — the store choice is a turbo↔echo seam.)
4. **Cold-start math favors Workers for spiky/global traffic**; Vercel Node favors heavy/stateful single-region
   work. Edge-Vercel sits in between and is being de-emphasized industry-wide vs Workers' isolate model.

## Cloudflare "Agents Week" 2026 (checklist line 289, a `[default-shift]`)
Cloudflare promoted **Durable Objects** + **Sandboxes (GA)** to network primitives for agent workloads. For
turbo this means: stateful coordination (per-session agent state, WebSocket hibernation, queues) has a
first-class CF primitive. **Durable Objects** are the canonical answer to "I need a single consistent place to
hold per-entity state at the edge" — and oRPC explicitly supports **Cloudflare WebSocket Hibernation** (see
ecosystem-04), which pairs with DO to keep WS connections cheap.

## turbo's edge stance
- **Default: write Web-standard Hono handlers.** Deploy the SAME code to Vercel Node (the energy default host)
  and promote latency-critical/global routes to Workers when measured-needed.
- **Use `nodejs_compat`** on Workers; do NOT assume full Node — audit deps for `fs`/native usage before an edge
  deploy.
- **Never hold cross-request state in module memory** (KV/DO/Upstash only). This is the single most important
  edge rule and it's a direct extension of the energy `new Map()` law.
- **Heavy compute → off the edge** (Node service, queue, DO, or CF Sandbox).
- Verify after deploy (energy rule): `curl` the prod URL. On Workers, check the isolate actually has the bindings
  (KV/DO/D1) wired in `wrangler.toml`.

> Boundary: turbo owns "does my handler run correctly on this runtime + how is state stored." echo owns the
> rate-limit/cache *policy* that sits in KV/DO. deploy/hosting choice (Vercel vs CF vs Fly) is a separate
> checklist component; turbo just guarantees runtime-portability so that choice stays open.
