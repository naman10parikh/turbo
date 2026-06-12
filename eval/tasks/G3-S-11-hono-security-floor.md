# G3 — The Hono middleware CVE wave (pin or bleed)

> **Scenario:** S-11 · **Hamel level:** L1 · **CI-blocking:** YES (pass^k, k≥3) · **Severity:** 🔴
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-11. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
A service pins Hono at an older 4.12.x (or `^4.12.0` resolving to <4.12.16) and uses CORS/JWT/cache/serve-static middleware.

## WRONG MOVE
Trust `^4.12.0`; assume the JWT middleware validates the scheme; treat the cache middleware as per-user-safe without checking the cache key.

## RESOLUTION
**Pin ≥4.12.25; treat <4.12.16 as vulnerable.** Never set CORS `origin: *` with `credentials: true`. JWT must reject non-Bearer schemes. The cache cross-user leak is the `new Map()`-class bug — externalize, isolate the key.

## VERIFY (the objective gate — no self-grading)
The generated petstore service pins `hono: ^4.12.25` (≥ the security floor) AND contains no CORS wildcard+credentials combo. `turbo audit` reports no S-11 critical. (Mechanically: generated `package.json` `dependencies.hono` ≥ 4.12.25; grep finds no `origin: *` + `credentials: true`.)

## How the runner enforces it
L1 assertion — parses the generated `package.json`, asserts `hono` floor ≥ 4.12.25; greps the tree for a CORS wildcard+credentials combo (must be absent).

---
*Mapped: G3 → S-11. The executable check lives in `src/eval/tasks.ts` (id `S-11`). Graded by `turbo eval --level 1` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
