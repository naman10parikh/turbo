# G4 — Native TS in CI without a type-check (the silent-`any` deploy)

> **Scenario:** S-13 · **Hamel level:** L1 · **CI-blocking:** YES (pass^k, k≥3) · **Severity:** 🟠
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-13. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
turbo adopts Node 24 native `.ts` execution (no build step); CI runs the service and deploys.

## WRONG MOVE
Assume 'it runs, so the types are fine' — type-stripping (`amaro`) strips but does NOT type-check and ignores `tsconfig.json`. The 'no any' law is silently violated.

## RESOLUTION
Keep a **`tsc --noEmit` CI gate** — non-negotiable under the energy law; the runtime won't enforce it. Avoid `enum`/value-`namespace`/decorators in turbo's code (strip-time breaks; prefer union + `as const`).

## VERIFY (the objective gate — no self-grading)
The generated service ships a `typecheck` script (`tsc -p tsconfig.json --noEmit`) AND grep finds no `enum `/value-`namespace`/experimental-decorator in the generated code. The acceptance CI runs `npx tsc --noEmit` and red-blocks on a type error. (Mechanically: generated `package.json` `scripts.typecheck` exists; the generated tree `tsc --noEmit`-passes today.)

## How the runner enforces it
L1 assertion — the generated `package.json` has a `typecheck`/`tsc --noEmit` script; the generated source greps clean of `enum `/`namespace ` value-exports.

---
*Mapped: G4 → S-13. The executable check lives in `src/eval/tasks.ts` (id `S-13`). Graded by `turbo eval --level 1` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
