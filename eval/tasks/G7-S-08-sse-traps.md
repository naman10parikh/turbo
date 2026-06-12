# G7 — The SSE stream that dumped (nginx) and swallowed its error (Hono)

> **Scenario:** S-08 · **Hamel level:** L2 · **CI-blocking:** YES (pass^k, k≥3) · **Severity:** 🔴→🟠
> Source: `brain/BATTLE-TESTED-SCENARIOS.md` S-08. Severity legend: 🔴 data-loss/security/bleed · 🟠 outage/boot-break/corruption · 🟡 perf/DX/maintainability.

## SETUP
An agent/LLM endpoint streams tokens via Hono `streamSSE` behind nginx; the handler does work inside the stream that can throw.

## WRONG MOVE
Add a `try/catch` around the whole route (won't help — stream already started); assume the CDN streams by default; rely on `app.onError`.

## RESOLUTION
(1) Set **`X-Accel-Buffering: no`** so nginx stops buffering. (2) **Pass the optional 3rd-arg error handler** to `streamSSE`; on error write an `event: error` frame then close. (3) Loop `while (!stream.aborted)` + `stream.onAbort()` so client disconnect stops token generation.

## VERIFY (the objective gate — no self-grading)
`turbo stream-doctor` flags a streaming route MISSING the 3rd-arg handler / `X-Accel-Buffering: no` (P-10/P-11) AND passes a correct one. (Mechanically: a fixture streaming route with neither guard → stream-doctor reports P-10 + P-11; a fixture with both → zero traps.)

## How the runner enforces it
L2 behavior — writes a bad streaming-route fixture (no 3rd-arg handler, no X-Accel-Buffering) → `turbo stream-doctor --json` reports P-10 and P-11; writes a guarded fixture → zero traps.

---
*Mapped: G7 → S-08. The executable check lives in `src/eval/tasks.ts` (id `S-08`). Graded by `turbo eval --level 2` — the VERIFY line above is the binary gate (`dsip.json noSelfGrading:true`).*
