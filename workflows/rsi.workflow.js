#!/usr/bin/env node
/**
 * turbo RSI engine (D17) — the deterministic $0/tokenless self-improvement loop.
 *
 * Runs the 6 dsip steps (dsip.json `loop.steps`, with the PLAN/D17 aliases in parens):
 *   1. refresh-brain          — re-read brain/TOOL-MATRIX.md pins
 *   2. re-verify-tool-matrix  — turbo check / npm view → flag drift + EOL + the Hono security floor
 *   3. run-eval-pyramid       — turbo eval (L1+L2); E19 owns the real pyramid (stub→"pending" until it lands)
 *   4. propose                — write a diff (the proposed pin bump) to a GATED branch dir; never auto-apply
 *   5. validate (test-gate)   — the proposed diff must pass the acceptance gate + no-regression
 *   6. ship (commit)          — a GATED PR with Git snap-back; only if the gate passed
 *
 * `--deterministic` → the $0 path (no network needed; the oracle degrades to its local pin table; no
 * Claude). The **Claude half** (LLM-authored non-mechanical diffs) is gated behind CLAUDE_CODE_OAUTH_TOKEN
 * (D8) — a no-op when the token is unset (dark = expected, not a miss).
 *
 * It is a plain ESM `.js` (no build step) so `.github/workflows/rsi.yml` runs it directly with `node`.
 * dsip contract honored: noSelfGrading (the gate is objective — the acceptance test, not the engine's
 * opinion); snapback granularity = component|repo (git); it NEVER commits unless the gate passes.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // workflows/
const ROOT = join(HERE, ".."); // repo root
const CLI = join(ROOT, "dist", "cli", "index.js");
const ORACLE = join(ROOT, "dist", "audit", "version-oracle.js");
const MATRIX = join(ROOT, "brain", "TOOL-MATRIX.md");

const DETERMINISTIC = process.argv.includes("--deterministic");
const HAS_CLAUDE_TOKEN = Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN);

/** One step's structured result for the run log. */
const steps = [];
function logStep(id, alias, status, detail) {
  const line = `[rsi] step ${steps.length + 1}/6: ${id}${alias ? ` (${alias})` : ""} — ${status}`;
  process.stdout.write(`${line}${detail ? ` :: ${detail}` : ""}\n`);
  steps.push({ id, alias, status, detail });
}

/** Run the built turbo CLI, capture stdout; never throws (returns {ok, out}). */
function turbo(args) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` || String(e) };
  }
}

async function main() {
  process.stdout.write(
    `turbo RSI engine — ${DETERMINISTIC ? "DETERMINISTIC ($0, tokenless)" : "full"} mode; ` +
      `Claude half ${HAS_CLAUDE_TOKEN ? "ARMED (token present)" : "dark (CLAUDE_CODE_OAUTH_TOKEN unset — D8)"}\n`,
  );

  // ── Step 1: refresh-brain — re-read the pin source ────────────────────────────────────────────
  let matrixText = "";
  try {
    matrixText = readFileSync(MATRIX, "utf8");
    const pinCount = (matrixText.match(/\*\*\d+\.\d+\.\d+\*\*/g) ?? []).length;
    logStep("refresh-brain", null, "ok", `re-read brain/TOOL-MATRIX.md (${pinCount} version pins)`);
  } catch (e) {
    logStep("refresh-brain", null, "error", `cannot read TOOL-MATRIX.md: ${e.message}`);
  }

  // ── Step 2: re-verify-tool-matrix — drift/floor/EOL, with a PLANTED stale pin to prove detection ─
  // The deterministic proof: plant a known-stale Hono pin in a COPY of the matrix and run the oracle
  // against it. 4.0.0 < the security floor 4.12.16 → flagged `vulnerable` regardless of network state.
  let drift = { detected: false, detail: "" };
  try {
    const { runVersionCheck } = await import(ORACLE);
    // Plant the stale pin in a temp copy (never mutate the real brain).
    const planted = matrixText.replace(/(\*\*Hono\*\*[^|]*\|\s*\*\*)4\.\d+\.\d+(\*\*)/, "$14.0.0$2");
    const tmpMatrix = join(mkdtempSync(join(tmpdir(), "turbo-rsi-matrix-")), "TOOL-MATRIX.md");
    writeFileSync(tmpMatrix, planted, "utf8");
    // Short timeout → stays well under 5s even fully offline (degrades to the local pin table).
    const result = await runVersionCheck(tmpMatrix, { timeoutMs: 1500 });
    const flagged = result.findings.filter((f) => f.status === "stale" || f.status === "vulnerable");
    const honoFlag = flagged.find((f) => f.pkg === "hono");
    drift = {
      detected: Boolean(honoFlag),
      detail: honoFlag
        ? `planted Hono 4.0.0 → ${honoFlag.status} (${honoFlag.note ?? ""})`
        : "planted stale pin NOT detected",
    };
    // Also run the REAL matrix check (no planted pin) so the run reflects true ecosystem state too.
    const realResult = await runVersionCheck(MATRIX, { timeoutMs: 1500 });
    const realStale = realResult.findings.filter((f) => f.status === "stale" || f.status === "vulnerable");
    logStep(
      "re-verify-tool-matrix",
      "turbo check / npm view",
      drift.detected ? "ok" : "error",
      `${drift.detail}; real matrix: ${realStale.length} stale/vulnerable, ${realResult.eolRuntimes.length} EOL, online=${realResult.online}`,
    );
  } catch (e) {
    logStep("re-verify-tool-matrix", "turbo check / npm view", "error", `oracle failed: ${e.message}`);
  }

  // ── Step 3: run-eval-pyramid — L1+L2 (E19 owns the real pyramid) ──────────────────────────────
  // turbo eval is an honest stub until E19 lands; record that faithfully (a stub is "pending", not a
  // pass and not a hard failure — the loop still completes its 6 steps deterministically).
  {
    const r = turbo(["eval", "--json"]);
    let evalStatus = "pending";
    let evalDetail = "turbo eval";
    try {
      const body = JSON.parse(r.out.trim());
      if (body.stub === true) {
        evalStatus = "pending";
        evalDetail = `turbo eval is a stub → ${body.implementedIn} (the pyramid lands there; loop continues)`;
      } else if (body.ok === true) {
        evalStatus = "ok";
        evalDetail = `eval pyramid green (${JSON.stringify(body).slice(0, 120)})`;
      } else {
        evalStatus = "error";
        evalDetail = `eval reported failure: ${JSON.stringify(body).slice(0, 160)}`;
      }
    } catch {
      evalDetail = `turbo eval output: ${r.out.slice(0, 160)}`;
    }
    logStep("run-eval-pyramid", "turbo eval", evalStatus, evalDetail);
  }

  // ── Step 4: propose — write a diff to a GATED branch dir (NEVER auto-apply to the real brain) ───
  // The deterministic proposal: if drift was detected, draft the pin bump as a patch artifact under a
  // gated dir. We never edit brain/TOOL-MATRIX.md here — proposing ≠ applying (the snapback contract).
  let proposalPath = null;
  {
    const gatedDir = join(ROOT, ".rsi", "proposed");
    mkdirSync(gatedDir, { recursive: true });
    proposalPath = join(gatedDir, `pin-bump-${Date.now()}.patch.md`);
    const proposal = drift.detected
      ? `# RSI proposal (deterministic) — ${new Date().toISOString()}\n\n` +
        `Detected: ${drift.detail}\n\n` +
        `Proposed action: bump the flagged pin in brain/TOOL-MATRIX.md to the current/secure version, ` +
        `then re-run the acceptance gate. This artifact is a PROPOSAL — not applied (snapback=component|repo).\n`
      : `# RSI proposal (deterministic) — ${new Date().toISOString()}\n\nNo drift detected on the real matrix; no bump proposed.\n`;
    writeFileSync(proposalPath, proposal, "utf8");
    logStep("propose", null, "ok", `wrote proposal artifact → ${proposalPath.replace(ROOT + "/", "")} (NOT applied)`);
  }

  // ── Step 5: validate (test-gate) — the proposed diff must pass the acceptance gate + no-regression ─
  // Objective gate (noSelfGrading): the generator must still pass its own audit (zero P-02/P-04) on the
  // acceptance fixture. We generate the acceptance service and audit it — the deterministic no-regression
  // gate that any proposed change must survive before ship.
  let gatePassed = false;
  {
    const acceptOut = join(mkdtempSync(join(tmpdir(), "turbo-rsi-accept-")), "service");
    const gen = turbo(["api", "--spec", "eval/fixtures/petstore.openapi.json", "--out", acceptOut, "--json"]);
    if (!gen.ok) {
      logStep("validate", "test-gate", "error", `acceptance codegen failed: ${gen.out.slice(0, 160)}`);
    } else {
      const audit = turbo(["audit", acceptOut, "--json"]);
      let critical = -1;
      try {
        const body = JSON.parse(audit.out.trim());
        critical = (body.findings ?? []).filter((f) => f.pitfall === "P-02" || f.pitfall === "P-04").length;
      } catch {
        critical = -1;
      }
      gatePassed = critical === 0;
      logStep(
        "validate",
        "test-gate",
        gatePassed ? "ok" : "error",
        gatePassed
          ? "acceptance gate PASS — generator output has 0 P-02/P-04 (no regression)"
          : `acceptance gate FAIL — ${critical} critical pitfall(s) or audit unreadable`,
      );
    }
  }

  // ── Step 6: ship (commit) — GATED. Only commit if the gate passed AND we're authorized to mutate ──
  // The deterministic loop PROPOSES but does NOT commit (the verify: "proposes a diff WITHOUT committing
  // unless the gate passes"). Even with a green gate, auto-commit is reserved for the Claude half (token)
  // or an explicit non-deterministic, opt-in apply — the deterministic CI run is a dry proposal.
  {
    const wouldCommit = gatePassed && !drift.detected; // nothing to apply when no real drift
    if (DETERMINISTIC) {
      logStep(
        "ship",
        "commit",
        "skipped",
        gatePassed
          ? `gate green but DETERMINISTIC mode is a dry proposal — NOT committing (proposal at ${proposalPath ? proposalPath.replace(ROOT + "/", "") : "n/a"})`
          : "gate not green — nothing to ship (correct: no commit on a red gate)",
      );
    } else if (HAS_CLAUDE_TOKEN) {
      // The Claude half would author + open a gated PR here. Dark by default (D8).
      logStep("ship", "commit", "armed", "CLAUDE_CODE_OAUTH_TOKEN present → Claude half would open a gated PR (snapback=component|repo)");
    } else {
      logStep("ship", "commit", "skipped", wouldCommit ? "gate green; Claude token absent → deferred (D8)" : "gate not green or no drift — no commit");
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────────────────────────
  const completed = steps.length === 6;
  const hardErrors = steps.filter((s) => s.status === "error").length;
  process.stdout.write(
    `\n[rsi] DONE — ${steps.length}/6 steps; planted-pin detected=${drift.detected}; gate=${gatePassed ? "PASS" : "—"}; ` +
      `committed=false (deterministic dry proposal); hard-errors=${hardErrors}\n`,
  );
  // $0 deterministic run is a success when all 6 steps ran AND the planted pin was detected AND no hard
  // error broke the chain. A "pending" eval (E19 not landed) is NOT a failure.
  const success = completed && drift.detected && hardErrors === 0;
  process.exit(success ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`✗ rsi.workflow: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
