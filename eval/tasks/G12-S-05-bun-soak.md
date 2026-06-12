# G12 — The 72-hour Bun memory leak (always-on trap)

> **Scenario:** S-05 · **Hamel level:** L3 · **CI-blocking:** no (graded, non-blocking) · **Severity:** 🟠
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-05. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
An always-on stateful service runs on Bun; CI and a 1-hour load test are green.

## WRONG MOVE
Trust CI + a short load test as proof of always-on stability; have no cheap rollback path.

## RESOLUTION
For any always-on service, **soak-test ≥72h before trusting Bun** (YELLOW in the matrix). Keep the core in Web-standard / Node-API-safe code (Hono runs on both) so a Bun↔Node swap is a config change, not a rewrite — the rollback path stays cheap. RED for payments-grade / PM2 / inspector-debug.

## VERIFY (the objective gate — no self-grading)
L3 trajectory (plan-graded, non-blocking). turbo's expertise produces the ≥72h soak gate + swappability proof — `turbo explain S-05` resolves to the soak-before-always-on-Bun + runtime-swappable process, and `turbo brain "Bun 72 hour soak memory leak always-on"` ranks S-05 top.

## How the runner enforces it
L3 trajectory — `turbo brain` ranks S-05 for the soak query; `turbo explain S-05` returns the ≥72h-soak + swappability plan (graded on process, non-blocking).

---
*Mapped: G12 → S-05. The executable check lives in `src/eval/tasks.ts` (id `S-05`). Graded by `turbo eval --level 3` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
