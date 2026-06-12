# G8 — The RPC client that lost its types (monorepo / absolute imports)

> **Scenario:** S-09 · **Hamel level:** L2 · **CI-blocking:** no (graded, non-blocking) · **Severity:** 🟠
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-09. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
A backend + TS frontend in separate monorepo packages; the frontend imports the app type via a `paths` alias to build `hc<AppType>()`.

## WRONG MOVE
Fight the types with `as any` (violates the law) / downgrade Hono / give up on typed RPC. Forget client+server `hono` versions must match exactly.

## RESOLUTION
Use **TS project references** (`composite: true` server + `references` from client), NOT `paths` aliases. **Pin identical `hono` versions** both sides. Ship **`hcWithType`** (precompiled client type), never raw `hc`, above ~20 routes.

## VERIFY (the objective gate — no self-grading)
The generated service exports a typed `hcWithType` client and the RPC client type resolves from `AppType` (not `unknown`) — proven by the generated `test/contract.test.ts` compiling the `Client` type under `tsc --noEmit`. (Mechanically: generated tree `tsc --noEmit`-passes with the `Client = hcWithType(...)` assertion AND `src/client.ts` uses `hcWithType`, not raw `hc`.)

## How the runner enforces it
L2 behavior — asserts the generated `src/client.ts` exports `hcWithType` (not raw `hc`); the generated tree `tsc --noEmit`-passes (the RPC type resolves, no 'excessively deep').

---
*Mapped: G8 → S-09. The executable check lives in `src/eval/tasks.ts` (id `S-09`). Graded by `turbo eval --level 2` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
