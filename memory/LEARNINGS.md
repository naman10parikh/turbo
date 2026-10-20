# turbo — LEARNINGS (append-only)

Every error → root cause → rule. Auto-compressed when >500 lines (memory-compress.sh).

## 2026-10-19 — the contract said what the schema could not read
**What broke:** Darwin's conformance check rejected `dsip.json` outright: `selection: "eval-gated"` is not a DSIP value, and the snapback granularity `component, repo` is outside the schema, so the contract graded L0 although the loop ran green every week.
**Rule:** write the contract in the schema's own words (`selection: performance`, granularity `skill, employee`), state anything the enum cannot say (a weekly cadence) in the free-text `runner`, and run `darwin-check` after any change to `dsip.json`.

## 2026-10-19 — what the plugin may write in a stranger's project
**Rule:** the plugin ships both law gates (the `tsc --noEmit` commit gate and the `new Map()`/PATCH write gate), because each acts only on its own narrow case. Their block log goes to `TURBO_GATE_LOG` (a temp file in `hooks/hooks.json`), never into the open project. The weekly loop's proposal is kept as a run artifact.
