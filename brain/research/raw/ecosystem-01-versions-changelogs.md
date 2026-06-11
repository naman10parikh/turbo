---
title: "Backend/Runtime — Canonical Tool Versions + 6-Month Changelog Deltas (June 2026)"
type: source
created: "2026-06-11"
updated: "2026-06-11"
tags: [versions, changelog, hono, zod, node, bun, fastify, express]
sources: ["npm registry (npm view)", "github.com/honojs/hono/releases", "github.com/nodejs/Release"]
summary: "Authoritative latest versions + what changed in the last 6 months for every canonical backend tool."
---

# Canonical Versions Snapshot (pulled via `npm view` on 2026-06-11)

| Tool | Latest (June 2026) | Notes |
|---|---|---|
| **hono** | **4.12.25** (pub 2026-06-09) | Created 2021-12; v4.0 line. No v5 announced. 30,905★, 369 open issues, last push 2026-06-09. |
| **zod** | **4.4.3** (pub 2026-05-04) | dist-tags: latest=4.4.3, beta=4.1.13-beta.0, canary=4.5.0-canary. v4.0 GA was ~mid-2025; 4.4 is current stable. |
| **fastify** | **5.8.5** (pub 2026-04-14) | v5 line. 5.8.0 landed 2026-03-05. |
| **express** | **5.2.1** (pub 2025-12-01) | latest=5.2.1, latest-4=4.22.2. Express 5.0.0 GA shipped 2024-09-10 (after a ~10yr beta). 5.2.0/5.2.1 both 2025-12-01. |
| **neverthrow** | **8.2.0** | The canonical Result<T,E> lib for TS. |
| **effect** | **3.21.3** | Effect ecosystem (heavyweight Result/typed-errors alt). |
| **@hono/zod-openapi** | **1.4.0** | Hono's OpenAPI-first stack (reached v1.0 — significant). |
| **@hono/zod-validator** | **0.8.0** | Still pre-1.0. |
| **@hono/node-server** | **2.0.4** | v2 — the Node adapter for Hono (Hono is runtime-agnostic). |
| **@trpc/server** | **11.17.0** | tRPC v11 line (stable since 2025). |
| **@ts-rest/core** | **3.52.1** | Contract-first REST. Still v3. |
| **@orpc/server** | **1.14.5** | oRPC — newer OpenAPI-native RPC contender; reached v1.x. |
| **valibot** | **1.4.1** | Zod alt — v1 GA. Modular, tiny bundle. |
| **arktype** | **2.2.0** | Zod alt — runtime types from TS syntax. |
| **drizzle-orm** | **0.45.2** | Still pre-1.0 (note for DB boundary; not owned here). |
| **undici** | **8.4.1** | Node's HTTP/1.1 client; v8 line. |
| **bun** | **1.3.14** | (npm shim version; see Bun section for real runtime cadence) |

> NOTE on dates: npm publish timestamps are authoritative and say 2026. (A WebFetch summary of the
> Hono releases page mislabeled years as "2024" — ignore that; npm `time` confirms 4.12.6→4.12.25 all
> landed Mar–Jun **2026**.)

---

# Node.js Release Lines (source: github.com/nodejs/Release schedule.json, fetched 2026-06-11)

| Version | Codename | LTS start | Maintenance | EOL | Status June 2026 |
|---|---|---|---|---|---|
| v18 | Hydrogen | 2022-10 | 2023-10 | **2025-04-30** | **DEAD** (EOL) |
| v20 | Iron | 2023-10 | 2024-10 | **2026-04-30** | **JUST EOL'd** (Apr 30, 2026) — Maintenance ended |
| v22 | Jod | 2024-10 | 2025-10 | 2027-04-30 | **Active→Maintenance** (entered maintenance Oct 2025) |
| v24 | Krypton | 2025-10 | 2026-10 | 2028-04-30 | **RECOMMENDED Active LTS** |
| v26 | (unnamed) | 2026-10 (planned) | — | 2029-04-30 | Current (started 2026-05-05) |

**LOAD-BEARING FINDING for turbo:** The checklist says "Node.js 20+ (Vercel min)". As of **2026-04-30, Node 20 hit EOL**.
The live recommendation is **Node 24 (Krypton, Active LTS through Oct 2027)**. Node 22 is the conservative floor
(maintenance, supported to Apr 2027). **turbo should target Node 22 floor / 24 default, NOT 20.** Vercel's
min has historically tracked the lowest maintained LTS — verify the current Vercel min at build time (Vercel
deprecated Node 18 builds in 2025; Node 20 deprecation follows EOL).

---

# Hono v4.12.x — Last-6-Months Changelog Deltas (the SECURITY WAVE)

Hono shipped a remarkable density of **security fixes** across April–June 2026. This is the single most
important changelog signal for a backend harness: Hono's middleware had multiple CVE-class bugs patched in
rapid succession. **Pin ≥ 4.12.25 and treat <4.12.16 as vulnerable.**

- **v4.12.25** (2026-06-09) — FIVE security fixes:
  1. **CORS middleware** wildcard-origin-with-credentials vulnerability (the classic `Access-Control-Allow-Origin: *` + `credentials: true` combo).
  2. **Body limit bypass on AWS Lambda** via understated `Content-Length`.
  3. **Path traversal in serve-static on Windows** using encoded backslash (`%5c`).
  4. **Set-Cookie header merging** issue on AWS Lambda ALB.
  5. **Lambda@Edge** repeated-header handling bug.
- **v4.12.24** (2026-06-08) — bearer-auth error-message clarity; IPv6 rendering fixes in utils.
- **v4.12.23** (2026-05-25) — **`Context` class now exported publicly** (matters for typed helpers/tests); compress middleware `contentTypeFilter`; serve-static backslash normalization.
- **v4.12.22** (2026-05-22) — MIME charset handling; compress respects `Accept-Encoding`; **WebSocket subprotocol support**; msgpack treated as compressible.
- **v4.12.21** (2026-05-19) — FOUR security fixes: `app.mount()`, IP-restriction middleware, cookie helpers, **JWT middleware was accepting ANY Authorization scheme (not only `Bearer`)** — fixed.
- **v4.12.18** (2026-05-06) — security: **cache middleware cross-user leakage**, CSS injection in JSX, JWT NumericDate validation.
- **v4.12.16** (2026-04-30) — security: JSX tag-name validation, bodyLimit chunked-request bypass.

**Taste / takeaway:** Hono's core is tiny and fast, but its **middleware surface is where the bugs live**
(CORS, JWT, cache, serve-static, bodyLimit). For turbo: (a) pin the latest patch, (b) do NOT trust the JWT
middleware's scheme handling on old versions, (c) the **cache middleware cross-user leak (4.12.18)** is exactly
the class of bug the energy `typescript.md` "no `new Map()` cross-request" rule warns about — shared mutable
state across requests. Echo (rate-limit/cache) must treat cache-key isolation as a first-class concern.

---

# Zod v4 line — what changed (Jan–May 2026)

- **4.4.0** (2026-04-29), **4.4.1** (same day), **4.4.2** (2026-05-01), **4.4.3** (2026-05-04) is current stable.
- 4.5.0 is in canary (many canary builds 2026-04-29 → 2026-05-04).
- The big architectural shift was **Zod 4.0** (mid-2025): a ground-up rewrite with `zod/v4` and a `zod/mini`
  tree-shakeable variant, ~14x faster string parsing and dramatically smaller bundle vs Zod 3, plus the
  **Standard Schema** spec adoption (the cross-validator interop standard now consumed by Hono, tRPC, etc.).
  Detail in ecosystem-03-zod.md.

# Fastify 5.8.x — recent
- 5.8.0 (2026-03-05) → 5.8.5 (2026-04-14). v5 line is stable; the big v4→v5 break (2024) removed the
  shared-schema `.addSchema` quirks and went full Node 20+. Detail in ecosystem-02 / ecosystem-12.

# Express 5.2.x — recent
- 5.0.0 GA finally shipped **2024-09-10** after a ~decade in beta. 5.1.0 (2025-03), 5.2.0/5.2.1 (2025-12-01).
  Express 5 brings: promise-rejection handling in middleware (async errors auto-forwarded), `path-to-regexp`
  upgrade (the `:param` syntax + the infamous `*` → named-wildcard breaking change), dropped Node <18.
  Express 4 (`latest-4` = 4.22.2) is still maintained for legacy. Detail in ecosystem-02 / ecosystem-12.
