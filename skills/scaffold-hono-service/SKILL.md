---
name: scaffold-hono-service
description: Stand up a new law-compliant Hono backend service from the proven w3cj reference baseline with deps bumped to current-safe pins. Use when asked to "stand up a backend", "scaffold a new API service", "start a new Hono service", or "create a backend from scratch". Encodes turbo's S-10 scenario + O-02/O-08/O-09 opinions — never a blank index.ts, never the unbumped starter.
---

# scaffold-hono-service

> Encodes scenario **S-10** (scaffold the energy-law-compliant service from scratch) and opinions **O-02** (default to Hono), **O-08** (OpenAPI-first, generated from Zod), **O-09** (Node 24 + native `.ts` but the `tsc --noEmit` gate is non-negotiable). The anti-pattern this kills: hand-rolling a flat `index.ts` that grows past 400 lines and breaks RPC inference, OR copying the reference repo without bumping its stale deps.

## Trigger

Invoke when the user (or a sibling employee / coding agent) asks to:
- "stand up / scaffold a new backend / API service"
- "start a new Hono service"
- "create a backend from scratch" / "I need a service to expose X"

Do NOT invoke for: adding a route to an existing service (that's normal editing), generating a service *from a spec the user already has* (use `gen_from_openapi` / `turbo api` — see `design-api-contract`), or anything frontend/mobile/db/auth/payments/deploy (those are pixel/pebble/acorn/badge/penny/rocket — out of turbo's boundary).

## Steps

1. **Decide blank vs from-spec.** If the user has an OpenAPI spec → this is the wrong skill; route to `turbo api --spec <file>` (the acceptance path) instead. If they want a fresh blank service → continue.
2. **Run the scaffold (do not hand-roll):**
   ```bash
   turbo scaffold --name <service-name> --out <dir> --json
   ```
   This stands up the `w3cj/hono-open-api-starter` baseline with deps **bumped** to current-safe pins (`hono@^4.12.25`, `zod@^4.4`, `@hono/zod-openapi@^1.4`) — the starter ships 0.x/Zod-3, and the bump-and-migrate is exactly where breakage hides (the v1 `@hono/zod-openapi` is a Zod-3→4 peer shift that drags in the PATCH-`.default()` trap, P-04). The scaffold wires: `/health`, `/openapi.json` + Scalar UI, `hcWithType` export, Pino JSON logs, `eslint-plugin-neverthrow`, and the `{name}.routes.ts` / `.handlers.ts` / `.index.ts` / `.test.ts` route-group layout that reconciles "chain `.route()`" with the <400-line law.
3. **Verify the law on the output (the gate, not "it compiles"):**
   ```bash
   cd <dir> && npm install && npx tsc --noEmit        # O-09: no `any`; native strip-types would NOT catch this
   npm run contract                                     # runtime OpenAPI conformance + RPC `typeof app` compile
   ```
   Both MUST be green. `tsc --noEmit` is non-negotiable — `node app.ts` strips types without type-checking, so the runtime never enforces the law.
4. **Self-audit the scaffold** (the generator must pass its own audit):
   ```bash
   turbo audit <dir> --json
   ```
   Expect **zero P-02** (no `new Map()` / module-scope mutable state) and **zero P-04** (no defaulted create-schema reused for PATCH).
5. **Confirm runtime swappability** (O-05 hedge): the core stays Web-standard / Node-API-safe so a Bun↔Node swap is a config change. Do NOT migrate to Bun "for speed" — its edge collapses to ~3% once a DB is involved.

## Output

A running, law-compliant Hono service directory plus a one-paragraph report:
- `tsc --noEmit`: PASS/FAIL (the law gate)
- `npm run contract`: PASS/FAIL (OpenAPI conformance + RPC type)
- `turbo audit`: P-02 count, P-04 count (both must be 0)
- pinned versions confirmed (`hono ≥4.12.25`, `zod ^4.4`, `@hono/zod-openapi ^1.x`)
- the route-group file layout, with no file >400 lines
- a note: "rate-limit / cache is echo's seam — not wired here."

If any gate fails, iterate (Ralph loop) — do not report "done" until all four checks are green.
