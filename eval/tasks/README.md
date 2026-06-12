# turbo eval — golden tasks (G1–G13 → S-IDs)

> The 13 golden tasks (PLAN §6), lifted from `brain/BATTLE-TESTED-SCENARIOS.md`. Each scenario carries a
> **binary VERIFY** line that is the objective gate (`dsip.json noSelfGrading:true` — never the agent's own
> opinion that it's done). The executable runner lives at `src/eval/` and is invoked by `turbo eval [--level 1|2|3]`.
> This directory is the **human-legible spec**; the runner enforces each VERIFY mechanically.

## Hamel pyramid

| Level | What it tests | Tasks |
| --- | --- | --- |
| **L1** assertion | single structural fact on the generated tree (schema distinct? version pinned? `tsc` gate present?) | G1/S-02, G2/S-04, G3/S-11, G4/S-13 |
| **L2** behavior | give the broken SETUP → assert the RESOLUTION + VERIFY pass (boot/request the service) | G5/S-01, G6/S-03, G7/S-08, G8/S-09, G9/S-12 |
| **L3** trajectory | multi-step process graded (scaffold-from-reference / sunset+contract / Strangler-Fig / soak) | G10/S-06, G11/S-07, G12/S-05, G13/S-10 |

## CI-blocking set (pass^k, k≥3)

**G1, G3, G4, G5, G7, G13** — the 🔴/🟠 correctness gates + the acceptance path. Each runs k≥3 trials in
CI; a single trial is not evidence. The L3 trajectory plans (G11/G12) are graded but **non-blocking**.

## The objective-gate rule

No self-grading. Every task's `verify` is a deterministic check (an assertion, a parse, a boot+request),
never "the agent says it's done." The acceptance test (`turbo api --spec petstore.openapi.json`) is the
spine — G1/G5/G13 are exercised directly on its output.

## Task index

| # | S-ID | Level | CI-blocking | File |
| --- | --- | --- | --- | --- |
| G1 | S-02 | L1 | YES | `G1-S-02-patch-no-default.md` |
| G2 | S-04 | L1 | no | `G2-S-04-native-addon-audit.md` |
| G3 | S-11 | L1 | YES | `G3-S-11-hono-security-floor.md` |
| G4 | S-13 | L1 | YES | `G4-S-13-tsc-noemit-gate.md` |
| G5 | S-01 | L2 | YES | `G5-S-01-no-module-state.md` |
| G6 | S-03 | L2 | no | `G6-S-03-express5-wildcard.md` |
| G7 | S-08 | L2 | YES | `G7-S-08-sse-traps.md` |
| G8 | S-09 | L2 | no | `G8-S-09-rpc-type-loss.md` |
| G9 | S-12 | L2 | no | `G9-S-12-date-roundtrip.md` |
| G10 | S-06 | L3 | no | `G10-S-06-versioning-contract.md` |
| G11 | S-07 | L3 | no | `G11-S-07-strangler-fig.md` |
| G12 | S-05 | L3 | no | `G12-S-05-bun-soak.md` |
| G13 | S-10 | L3 | YES | `G13-S-10-scaffold-from-reference.md` |
