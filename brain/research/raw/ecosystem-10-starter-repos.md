---
title: "Best Starter / Template / Example Repos for the turbo Stack (June 2026)"
type: source
created: "2026-06-11"
updated: "2026-06-11"
tags: [starters, templates, hono, boilerplate, openapi]
sources:
  - "gh search repos / gh api (fetched 2026-06-11)"
  - "https://github.com/w3cj/hono-open-api-starter (WebFetch 2026-06-11)"
summary: "5 best reference repos for turbo's TS-strict + Hono + Zod backend. w3cj/hono-open-api-starter is THE canonical OpenAPI-first reference; create-better-t-stack is the scaffolder; honojs/examples is the multi-runtime cookbook."
---

# The 5 repos a turbo backend should mine (ranked by relevance to the law)

## 1. ⭐ `w3cj/hono-open-api-starter` — 997★, last push 2025-10-31  [THE REFERENCE]
**Why it's #1 for turbo:** it implements the *exact* energy law stack end-to-end and demonstrates the
OpenAPI-first single-source-of-truth pattern the harness should default to.
- **Stack:** Hono · `@hono/zod-openapi` · Drizzle + `drizzle-zod` · Zod · **Pino**/`hono-pino` (structured logs)
  · **Scalar** (interactive docs) · **Vitest** · **Stoker** (helpers).
- **Patterns it teaches:**
  - **OpenAPI-first** — routes auto-generate the spec (`createRoute` + `OpenAPIHono`).
  - **Single source of truth** — DB schema in Drizzle → `drizzle-zod` → Zod → validation + TS types + OpenAPI.
    One definition, every layer. (This is the cleanest answer to "Zod at every boundary" + "no drift.")
  - **Route-group file layout that respects the <400-line law:**
    `routes/tasks/{tasks.routes.ts (definitions), tasks.handlers.ts (logic), tasks.index.ts (router), tasks.test.ts}`
    then chained into one `AppType` export — this is exactly how to reconcile "chain `.route()` for RPC
    inference" (Hono gotcha #2) with "files < 400 lines."
  - **Typed env** (`env.ts`), typed routes, colocated unit tests.
- **turbo action:** use this as the **skeleton baseline**. Caveat: last push Oct 2025 → bump `@hono/zod-openapi`
  to 1.4.0, Zod to 4.4.3, re-pin Hono to ≥4.12.25 (security wave) before using.

## 2. ⭐ `AmanVarshney01/create-better-t-stack` — 5,452★, last push 2026-06-10  [THE SCAFFOLDER]
A modern CLI that scaffolds **end-to-end type-safe TS projects** with best practices and **customizable**
backend/frontend/db/auth choices (supports Hono, tRPC/oRPC, Drizzle/Prisma, etc.). Most actively maintained
scaffolder in the space.
- **turbo action:** run it to generate a known-good baseline and **diff its choices** against turbo's law
  (it'll pick sensible defaults for tsconfig strictness, lint, test). Good source of "what the ecosystem
  considers default in mid-2026."

## 3. ⭐ `honojs/examples` — 835★, last push 2026-03-21  [THE COOKBOOK]
Official Hono examples across **every runtime** (Workers, Bun, Deno, Node, Vercel, Lambda) + middleware recipes.
- **turbo action:** the authoritative source for "how do I do X on runtime Y with Hono" — streaming, JWT, CORS,
  serve-static, RPC client. First place to look before hand-rolling.

## 4. `cloudflare/chanfana` — 741★, last push 2026-06-09  [OPENAPI ENGINE]
Cloudflare's **OpenAPI 3 / 3.1 schema generator + validator** for Hono / itty-router. An alternative to
`@hono/zod-openapi` maintained by Cloudflare itself — relevant if turbo targets Workers specifically and wants
CF-blessed OpenAPI tooling.
- **turbo action:** consider for Workers-first deployments; otherwise `@hono/zod-openapi` (v1.0) is the default.

## 5. `rhinobase/honohub` — 463★, last push 2026-04-14  [REAL APP REFERENCE]
A **headless CMS** built on Hono + Drizzle + Zod + Vite — a non-trivial, real-world app showing the stack at
scale (auth, admin, CRUD generation). Good for seeing how the patterns compose beyond a to-do demo.

---

# Also noted (adjacent, for completeness)
- `matschik/fastify-typescript-starter` (259★, 2026-06-03) / `yonathan06/fastify-typescript-starter` (164★) —
  the canonical **Fastify** starters, for the Node-only-service path (ecosystem-02/12).
- `timothymiller/t4-app` (1,717★, 2026-06-09) — full-stack meta-framework (Hono backend + Expo/Next) — heavier
  than turbo needs but a reference for the Hono-RPC-to-client wiring.
- `rhinobase/hono-rate-limiter` (642★) — **rate-limit middleware for Hono.** FLAG: this is **echo's** territory
  (Wave-2 rate-limit/cache), not turbo's — but it's the de-facto Hono rate-limiter and the turbo↔echo seam.
- `ValueMelody/melody-auth` (619★) — turnkey OAuth/auth for Workers + Node (auth component, not turbo's, but
  relevant to the product surface).

## Selection rationale (taste)
I rejected dozens of 0–5★ "hono-drizzle-zod" exercise repos. The bar: **actively maintained (2026 pushes) +
demonstrates a real pattern (OpenAPI-first, multi-runtime, single-source-of-truth) + matches the energy law.**
`hono-open-api-starter` wins because it's the only one that wires the *entire* law (Zod-at-boundary + typed
routes + OpenAPI + structured logging + tests + the file-split pattern) in one coherent skeleton.
