# G10 — Versioning theater (the 17% gap) + zombie versions

> **Scenario:** S-06 · **Hamel level:** L3 · **CI-blocking:** no (graded, non-blocking) · **Severity:** 🟠
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-06. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
turbo ships `/v1` then `/v2` of a public API; no contract tests; the OpenAPI spec is hand-maintained alongside the code.

## WRONG MOVE
Believe 'we version, so we're safe' — versioning is a *promise*; contract testing is the *enforcement*.

## RESOLUTION
Be the **17%**: generate OpenAPI FROM the Zod schemas (`@hono/zod-openapi`) so the validator IS the contract; add runtime-conformance tests + `oasdiff` in CI to fail on breaking spec diffs; write the **sunset policy on day 1** (deprecation header + window). Additive-only within a major; breaking ⇒ `/vN+1`.

## VERIFY (the objective gate — no self-grading)
L3 trajectory (process). The generated service serves `/openapi.json` GENERATED from the schemas (not hand-authored), the contract test asserts a response validates against it, and turbo's expertise (`turbo explain S-06`) names the oasdiff-gate + day-1-sunset process. (Mechanically: generated `src/openapi.ts` derives the doc from the spec; `test/contract.test.ts` validates `/openapi.json`; the sunset/oasdiff policy is queryable.)

## How the runner enforces it
L3 trajectory — asserts the generated tree serves `/openapi.json` + a conformance test exists; `turbo explain S-06` returns the conformance+oasdiff+sunset process (graded on the process being present, not blocking).

---
*Mapped: G10 → S-06. The executable check lives in `src/eval/tasks.ts` (id `S-06`). Graded by `turbo eval --level 3` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
