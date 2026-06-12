# G6 — Express 4→5 bump throws at boot ('Missing parameter name')

> **Scenario:** S-03 · **Hamel level:** L2 · **CI-blocking:** no (graded, non-blocking) · **Severity:** 🟠
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-03. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
An inherited Express 4 service with catch-all routes (`app.all('*')`, `app.get('/*')`); a task asks to 'update Express to latest.'

## WRONG MOVE
Treat it as a patch / roll back to v4 / blame a dependency.

## RESOLUTION
Express 5 (path-to-regexp v8) requires **named** wildcards: `*` → `/*splat` (`/{*splat}` for root). Wildcards now capture an **array** (`req.params.splat = [...]`). Treat the v4→v5 bump as a migration. (Bonus: turbo defaults to Hono — Web-standard routing, no path-to-regexp.)

## VERIFY (the objective gate — no self-grading)
turbo's expertise encodes the fix — `turbo explain S-03` resolves to the `/*splat` + array-capture detection+fix, and `turbo brain "Express 5 wildcard Missing parameter name boot"` ranks S-03 top. (L2 knowledge-behavior: given the boot-break symptom, turbo produces the named-wildcard RESOLUTION, not a rollback.)

## How the runner enforces it
L2 behavior — `turbo brain` ranks S-03 for the boot-break query; `turbo explain S-03` returns the `/*splat`/array-capture fix (the RESOLUTION is produced, not a give-up).

---
*Mapped: G6 → S-03. The executable check lives in `src/eval/tasks.ts` (id `S-03`). Graded by `turbo eval --level 2` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
