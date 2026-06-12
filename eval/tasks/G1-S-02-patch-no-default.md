# G1 — PATCH that erased fields (Zod `.default()` data loss)

> **Scenario:** S-02 · **Hamel level:** L1 · **CI-blocking:** YES (pass^k, k≥3) · **Severity:** 🔴
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-02. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
A CRUD resource reuses its create-schema (with `.default()`s) to validate the PATCH body under `.partial()`.

## WRONG MOVE
Assume `.partial()` makes defaults conditional — it does NOT (Zod 4 `.default()` fires on `undefined` unconditionally, even under `.partial()`).

## RESOLUTION
Maintain a **dedicated PATCH schema with NO `.default()`s**. The create schema keeps its defaults; the PATCH schema is a distinct object using `.optional()`.

## VERIFY (the objective gate — no self-grading)
On the generated petstore service: the PATCH op's body schema is distinct from the create op's AND contains no `.default(`. `turbo audit` reports zero P-04. (Mechanically: grep `src/app.ts` — the `.patch(` block has `.optional()` on `status`, the `.post(` block has `.default("available")`.)

## How the runner enforces it
L1 assertion — reads generated `src/app.ts`, asserts the PATCH handler block has no `.default(` and the create block does; `turbo audit --json` on the tree has no P-04 finding.

---
*Mapped: G1 → S-02. The executable check lives in `src/eval/tasks.ts` (id `S-02`). Graded by `turbo eval --level 1` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
