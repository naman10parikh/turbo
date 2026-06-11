---
title: "Ecosystem Research — Backend/Runtime Domain (turbo) — INDEX"
type: synthesis
created: "2026-06-11"
updated: "2026-06-11"
tags: [ecosystem, backend, runtime, typescript, hono, zod, bun, node, edge]
researcher: ECOSYSTEM (CP123 Wave-R)
summary: "Index of all ecosystem-* research files for turbo (backend/runtime domain). June 2026 state of the art."
---

# turbo Backend/Runtime — Ecosystem Research INDEX (June 2026)

Researcher: ECOSYSTEM agent (CP123 Wave-R). Scope: TS strict + Node 20/22, Hono v4, Zod-at-boundary,
API design (REST/RPC/OpenAPI/versioning), Result<T,E>, Bun prod-readiness, edge runtimes, streaming
(SSE/WS), contract testing. Rate-limit/cache = Wave-2 echo's domain (boundary documented, not owned here).

## Internal law honored (quoted from energy, read-only)
From `~/energy/.claude/rules/typescript.md`:
- No `any`, no `as unknown`, no non-null assertions unless proven safe.
- `interface` over `type` for object shapes.
- Zod for runtime validation at API boundaries.
- Result<T,E> pattern, never try-catch-swallow. Every catch must `console.warn("[module] context:", err.message)` or comment `// Intentionally silent: [reason]`.
- Async: always handle rejections, never fire-and-forget.
- Files < 400 lines. Named exports only. No default exports. Const over let. No var.
- **NEVER `new Map()` for cross-request state in Vercel API routes** — cold Lambdas have empty state; use Upstash/Supabase or pass IDs from client.

From `~/energy/audit/HARNESS-CHECKLIST-2026.md` (Backend/Runtime, line 261-265):
- Default: TypeScript strict + Node.js 20+ (Vercel min); no any; Zod at every API boundary; Result<T,E>.
- 2026: Bun production-ready (8-15ms cold; consider for edge/CLI); Hono v4 de-facto for Cloudflare Workers.
- Vercel needs Node 20.9+.

## Files
- ecosystem-00-INDEX.md (this file)
- ecosystem-01-versions-changelogs.md — current versions + 6mo changelog deltas
- ecosystem-02-hono.md — Hono v4 deep dive, vs Express/Fastify
- ecosystem-03-zod.md — Zod at every boundary, v4 migration
- ecosystem-04-api-design.md — REST vs RPC, OpenAPI-first, versioning
- ecosystem-05-result-error-handling.md — Result<T,E> in TS, neverthrow et al.
- ecosystem-06-bun-runtime.md — Bun production readiness
- ecosystem-07-edge-runtimes.md — CF Workers, Vercel functions
- ecosystem-08-streaming.md — SSE / WebSocket patterns
- ecosystem-09-contract-testing.md — contract testing, Pact, schema-driven
- ecosystem-10-starter-repos.md — best starter/template/example repos
- ecosystem-11-github-issues.md — real-world breakage from issues
- ecosystem-12-tradeoff-matrix.md — competing tools honest matrix
- ecosystem-13-agent-operator.md — what an AGENT needs (CLIs/APIs/MCPs)
- ecosystem-14-verification-and-gap-closure.md — 2nd-pass: live version re-verify + 3 open gaps CLOSED (Vercel Node min, @hono/zod-openapi v1 breaks, framework perf) + 3 NET-NEW (neverthrow slowdown, Hono RPC issue ledger, verbatim Hono streaming API)
- ecosystem-99-REPORT.md — final report + gaps
