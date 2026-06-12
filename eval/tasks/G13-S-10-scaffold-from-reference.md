# G13 — Scaffolding the energy-law-compliant service from the reference

> **Scenario:** S-10 · **Hamel level:** L3 · **CI-blocking:** YES (pass^k, k≥3) · **Severity:** 🟡
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-10. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
A task: 'stand up a new turbo backend service' (TS strict, Zod-at-boundary, typed routes, OpenAPI, structured logs, tests, <400-line files).

## WRONG MOVE
Build from a blank file; use a random 0-5★ exercise repo; copy the reference WITHOUT bumping its stale deps.

## RESOLUTION
Use **`w3cj/hono-open-api-starter`** as the skeleton — wires the whole law (Hono + `@hono/zod-openapi` + Zod + Pino/`hono-pino` + Scalar + Vitest) and the route-group layout that reconciles chain-`.route()` with <400 lines. **Bump before use:** `@hono/zod-openapi`→1.x, Zod→4.4.3, Hono→≥4.12.25. Add `/health`, `/openapi.json`+Scalar, `hcWithType`.

## VERIFY (the objective gate — no self-grading)
**This IS the acceptance test's process.** `turbo api --spec petstore.openapi.json` (or `turbo scaffold`) → `tsc --noEmit` passes (no `any`), every boundary has a Zod parse, routes chained into one `AppType`, no file >400 lines, `/openapi.json` serves + a response validates against it, deps at the bumped pins. (Mechanically: generate the service, `npm install` + `npm run contract` green, `tsc --noEmit` 0 errors, no file >400 lines.)

## How the runner enforces it
L3 trajectory — generates the service, runs `tsc --noEmit` + `npm run contract` in the tree (both green), asserts no file >400 lines and deps at the bumped pins. This is the acceptance spine.

---
*Mapped: G13 → S-10. The executable check lives in `src/eval/tasks.ts` (id `S-10`). Graded by `turbo eval --level 3` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
