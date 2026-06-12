#!/usr/bin/env node
/**
 * assert-no-critical-pitfalls — the acceptance CI's critical-pitfall gate (E19, SOLE creator).
 *
 * Reads `turbo audit <dir> --json` from stdin and exits NON-ZERO if any critical pitfall
 * (P-02 — module-scope `new Map()`/mutable cross-request state; P-04 — defaulted schema
 * reused for PATCH) is present. Consumed (not re-created) by `.github/workflows/acceptance.yml`
 * (E23) as the final gate: `turbo audit ./.accept --json | node eval/assert-no-critical-pitfalls.mjs`.
 *
 * Zero-dep, plain ESM (runs under Node 24 with no build). Deterministic: same input → same exit.
 */

/** Pitfalls that are merge-blocking — a generated service with any of these is a real defect. */
const CRITICAL = new Set(["P-02", "P-04"]);

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

const raw = (await readStdin()).trim();

if (raw.length === 0) {
  process.stderr.write("✗ assert-no-critical-pitfalls: empty stdin (expected `turbo audit --json` output)\n");
  process.exit(2);
}

let report;
try {
  report = JSON.parse(raw);
} catch (e) {
  process.stderr.write(`✗ assert-no-critical-pitfalls: stdin is not valid JSON: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
}

const findings = Array.isArray(report?.findings) ? report.findings : [];
const criticals = findings.filter((f) => CRITICAL.has(f?.pitfall));

if (criticals.length > 0) {
  process.stderr.write(`✗ assert-no-critical-pitfalls: ${criticals.length} critical pitfall(s) found:\n`);
  for (const f of criticals) {
    const loc = f.line && f.line > 0 ? `${f.file}:${f.line}` : f.file;
    process.stderr.write(`  [${String(f.severity).toUpperCase()}] ${f.pitfall}  ${loc} — ${f.message ?? ""}\n`);
  }
  process.exit(1);
}

process.stdout.write(`✓ assert-no-critical-pitfalls: 0 critical pitfalls (P-02/P-04) across ${findings.length} finding(s)\n`);
process.exit(0);
