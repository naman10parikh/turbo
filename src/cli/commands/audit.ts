/**
 * `turbo audit <dir> [--json]` — run the `brain/KNOWN-PITFALLS.md` pitfall detectors over a service.
 *
 * Walks the service tree, builds ScanFiles, runs every detector (P-02/P-04/P-09/P-10-11/P-03/S-11),
 * and emits findings keyed by P-ID: `[{ pitfall, file, line, severity, message }]`. The generator's
 * own output (B6/B7) MUST pass this with zero P-02/P-04 (PLAN Risk #1 — "passes its own audit").
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { DETECTORS } from "../../audit/detectors/index.js";
import type { Finding, ScanFile } from "../../audit/types.js";
import { emitJson, fail, info, ok as printOk } from "../io.js";
import { logRun } from "../../obs/run-logger.js";

export interface AuditOptions {
  dir: string;
  json: boolean;
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".accept", "coverage"]);
const SCAN_EXT = /\.(ts|tsx|js|mjs|cjs|ya?ml)$/;

/** Recursively collect scannable files (relative paths) under a root. */
function collectFiles(root: string): ScanFile[] {
  const out: ScanFile[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return; // unreadable dir — skip, never crash
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        walk(full);
      } else if (SCAN_EXT.test(name)) {
        try {
          out.push({ path: relative(root, full), text: readFileSync(full, "utf8") });
        } catch {
          // unreadable file — skip
        }
      }
    }
  };
  walk(root);
  return out;
}

/** Load the service's package.json (for the P-09 script-gate detector), if present. */
function loadPkg(root: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function runAudit(opts: AuditOptions): void {
  const start = Date.now();
  const root = resolve(opts.dir);

  // Validate the target exists and is a directory BEFORE scanning — otherwise a typo'd path
  // walks an empty tree and the detectors fabricate findings (e.g. P-09 firing on a phantom
  // missing package.json). A non-existent path is a usage error, not a clean audit.
  let rootStat;
  try {
    rootStat = statSync(root);
  } catch {
    const msg = `turbo audit: directory not found: ${root}`;
    if (opts.json) {
      emitJson({ ok: false, dir: root, error: msg, findings: [] });
    }
    fail(msg);
    return;
  }
  if (!rootStat.isDirectory()) {
    const msg = `turbo audit: not a directory: ${root}`;
    if (opts.json) {
      emitJson({ ok: false, dir: root, error: msg, findings: [] });
    }
    fail(msg);
    return;
  }

  const files = collectFiles(root);
  const pkg = loadPkg(root);

  const findings: Finding[] = [];
  for (const detector of DETECTORS) {
    findings.push(...detector.detect(files, pkg));
  }

  logRun({
    command: "audit",
    model: "deterministic",
    duration_ms: Date.now() - start,
    cost: 0,
    outcome: "ok",
    ts: new Date().toISOString(),
    detail: `${root}: ${findings.length} findings`,
  });

  if (opts.json) {
    emitJson({ ok: true, dir: root, findings });
    return;
  }

  if (findings.length === 0) {
    printOk(`turbo audit: 0 pitfalls in ${root}`);
    return;
  }
  for (const f of findings) {
    const loc = f.line > 0 ? `${f.file}:${f.line}` : f.file;
    info(`[${f.severity.toUpperCase()}] ${f.pitfall}  ${loc}`);
    info(`  ${f.message}`);
  }
  // A critical finding sets a non-zero exit (an agent can gate on rc). Informational ones don't.
  if (findings.some((f) => f.severity === "critical")) {
    fail(`turbo audit: ${findings.filter((f) => f.severity === "critical").length} critical pitfall(s)`);
  }
}
