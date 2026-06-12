# G9 — The Date that round-tripped as a string (typed RPC + JSON)

> **Scenario:** S-12 · **Hamel level:** L2 · **CI-blocking:** no (graded, non-blocking) · **Severity:** 🟡
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-12. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
A Hono RPC handler returns `c.json({ createdAt: new Date() })`; the TS client consumes it via `hc<AppType>`.

## WRONG MOVE
Expect `Date` to round-trip over plain JSON — it can't (`JSON.stringify` serializes Date→string; typed RPC surfaces the gap sharply).

## RESOLUTION
Serialize dates to ISO strings explicitly and `new Date(...)` on the client; document the wire type as string in the contract. OR use **oRPC** (native Date) for pervasively rich-type external APIs.

## VERIFY (the objective gate — no self-grading)
turbo's expertise encodes the round-trip rule — `turbo explain S-12` resolves to the explicit-ISO-parse / oRPC fix, and `turbo brain "Date round trip string typed RPC JSON"` ranks S-12 top. (L2 knowledge-behavior: turbo produces the explicit-serialize RESOLUTION, never assumes Date round-trips.)

## How the runner enforces it
L2 behavior — `turbo brain` ranks S-12 for the Date-roundtrip query; `turbo explain S-12` returns the explicit-ISO-parse / oRPC fix.

---
*Mapped: G9 → S-12. The executable check lives in `src/eval/tasks.ts` (id `S-12`). Graded by `turbo eval --level 2` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
