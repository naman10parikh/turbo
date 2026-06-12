# G11 — The framework migration that didn't freeze development (Strangler Fig)

> **Scenario:** S-07 · **Hamel level:** L3 · **CI-blocking:** no (graded, non-blocking) · **Severity:** 🟠
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-07. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
A working Express service needs to move to Fastify; the team cannot stop feature work.

## WRONG MOVE
Rewrite all at once; discover mid-flight a legacy payment integration has no Fastify equivalent.

## RESOLUTION
Strangler Fig: first PR **wraps** the Express app via `@fastify/express`; each successive PR moves a few routes. **Audit every middleware/plugin for no-equivalent packages BEFORE starting.** The compat bridge is a BRIDGE not a destination — finish the strangle. Justify by DX/correctness, not speed.

## VERIFY (the objective gate — no self-grading)
L3 trajectory (plan-graded, non-blocking). turbo's expertise produces the incremental wrap-then-strangle plan with the dependency-equivalence audit first — `turbo explain S-07` resolves to the audit-first wrap-then-strangle process, and `turbo brain "Strangler Fig migration Express Fastify wrap"` ranks S-07 top. NEVER a big-bang.

## How the runner enforces it
L3 trajectory — `turbo brain` ranks S-07 for the migration query; `turbo explain S-07` returns the audit-first wrap-then-strangle plan (graded on process, non-blocking).

---
*Mapped: G11 → S-07. The executable check lives in `src/eval/tasks.ts` (id `S-07`). Graded by `turbo eval --level 3` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
