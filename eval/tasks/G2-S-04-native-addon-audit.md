# G2 — Bun image-pipeline migration (sharp = 2 weeks)

> **Scenario:** S-04 · **Hamel level:** L1 · **CI-blocking:** no (graded, non-blocking) · **Severity:** 🟡→🟠
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-04. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
An image-processing API on Node uses `sharp` (native node-gyp addon) on the hot path; a proposal says 'migrate to Bun for speed.'

## WRONG MOVE
Migrate blind for a marketing '3x faster' claim; hit native-addon hell mid-flight.

## RESOLUTION
Run a **native-addon audit BEFORE the decision** (`sharp`/`bcrypt`/node-gyp are the worst case for Bun). If Bun.Image is used, confirm the required codecs/features are covered (no ICC / no animated WebP/GIF / no `.tile()` gaps) or retain `sharp` on the gap paths. Pin the Bun version in CI.

## VERIFY (the objective gate — no self-grading)
turbo's expertise encodes the audit recipe — `turbo explain S-04` resolves to a detection+fix, and `turbo brain "Bun native addon sharp image pipeline"` ranks S-04 in the top hits. (L1 knowledge assertion — the audit-first stance is queryable; turbo never silently recommends a blind Bun migration.)

## How the runner enforces it
L1 assertion — `turbo brain` ranks S-04 for the native-addon query AND `turbo explain S-04` returns a non-empty detection+fix (the expertise is present + queryable, not a knowledge hole).

---
*Mapped: G2 → S-04. The executable check lives in `src/eval/tasks.ts` (id `S-04`). Graded by `turbo eval --level 1` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
