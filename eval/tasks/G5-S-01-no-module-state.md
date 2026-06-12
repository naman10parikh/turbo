# G5 — Cross-user data bleed (module state under Fluid Compute)

> **Scenario:** S-01 · **Hamel level:** L2 · **CI-blocking:** YES (pass^k, k≥3) · **Severity:** 🔴
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-01. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
A route caches a per-request value at module scope to 'avoid recomputation'; Vercel Fluid Compute is default-on; one warm instance serves dozens of concurrent requests.

## WRONG MOVE
Blame Fluid Compute / add a mutex / 'works locally so ship it' (emulators don't reuse containers → invisible in `vercel dev`).

## RESOLUTION
Treat everything outside the handler as a constant. Move mutable state into function scope. For genuine cross-request cache/session, externalize (Upstash/Supabase) or pass the ID from the client (the `new Map()` law).

## VERIFY (the objective gate — no self-grading)
The generated service has **zero module-scope mutable cross-request state** in its routes. A concurrency test (parallel requests with distinct inputs against the booted service) returns each caller's own data. `turbo audit` reports zero P-02. (Mechanically: boot the generated app in-process, fire N parallel requests with distinct params, assert no cross-contamination; audit the tree → no P-02.)

## How the runner enforces it
L2 behavior — boots the generated app (in-process Fetch), fires parallel requests with distinct path params, asserts each response reflects its own input; `turbo audit --json` has no P-02.

---
*Mapped: G5 → S-01. The executable check lives in `src/eval/tasks.ts` (id `S-01`). Graded by `turbo eval --level 2` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
