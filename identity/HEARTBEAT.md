# turbo — Heartbeat

> Cron-like cadence for the backend/runtime employee. turbo's heartbeat is the **deterministic RSI loop**
> (`workflows/rsi.workflow.js`) — it keeps turbo current against a fast-moving 2026 ecosystem where
> inversions move quarterly. Wired as a GitHub Actions `workflow_dispatch`/`schedule` (`rsi.yml`).

## Schedule

| Check | Frequency | Action on anomaly |
| --- | --- | --- |
| **Version-drift** (`turbo check` — `npm view` vs `brain/TOOL-MATRIX.md` pins) | nightly (RSI loop) | flag drift / newly-EOL runtime (Node-20 class) / Hono security floor (<4.12.16) → propose a gated pin-bump diff |
| **Eval pyramid** (`turbo eval` — L1 assertions + L2 behavior) | nightly + every CI run | if a CI-blocking task (G1/G3/G4/G5/G7/G13) goes red → block; git snap-back at component/repo |
| **Acceptance test** (`turbo api` on the Petstore fixture) | every push/PR (`acceptance.yml`) | if `tsc --noEmit`/contract/audit fails → red-block the merge |
| **Brain freshness** (`refresh-brain` — re-read TOOL-MATRIX pins) | nightly (RSI loop) | if an ecosystem-watch signal lands (new Hono CVE, Zod major, Bun RED→GREEN flip) → Claude-half drafts a brain update (when token set) |

## Health indicators

- **Healthy:** acceptance test green; no version drift past the security floor; eval L1+L2 green.
- **Warning:** a pin is stale (non-security) OR an L3 trajectory task degraded.
- **Critical:** the acceptance test is red OR Hono pin <4.12.16 (the middleware-CVE floor) OR a CI-blocking
  golden task (data-bleed/SSE/PATCH) fails → the merge is blocked; snap back.

## Recovery

1. Read the failing `verify:` line + the relevant pitfall (`turbo explain <P-id>`).
2. Check `memory/LEARNINGS.md` for a known fix.
3. If fixable deterministically (a pin bump, a regenerated schema): propose the diff through the eval gate;
   commit only if the acceptance test + no-regression gate passes.
4. If it needs taste (a new inversion, a closed dispute): the Claude half drafts a `brain/` update through
   the same gate (gated behind `CLAUDE_CODE_OAUTH_TOKEN`, D8).
