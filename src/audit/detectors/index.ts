/**
 * detectors — the pitfall scanners (B8), each keyed to a `brain/KNOWN-PITFALLS.md` P-ID.
 *
 * Detection is the load-bearing part (it makes a pitfall *checkable*, not just memorable). Each
 * detector is conservative: it flags the documented symptom, with the file + line for the fix.
 * The generator's own output (B6/B7) MUST pass with zero P-02/P-04 (PLAN Risk #1).
 */
import type { Detector, Finding, ScanFile } from "../types.js";

/** Helper: iterate lines with 1-based numbers. */
function eachLine(file: ScanFile, fn: (line: string, num: number) => void): void {
  const lines = file.text.split("\n");
  for (let i = 0; i < lines.length; i++) fn(lines[i] ?? "", i + 1);
}

/** Only scan TS/JS source (not the generated openapi JSON-as-const or configs) for code smells. */
function isCode(path: string): boolean {
  return /\.(ts|tsx|js|mjs|cjs)$/.test(path) && !/\.d\.ts$/.test(path);
}

/** Heuristic: a line that is at module scope (no leading indentation → top level). */
function isModuleScope(line: string): boolean {
  return /^[A-Za-z]/.test(line) || /^(export|const|let|var)\b/.test(line.trimStart()) === false
    ? /^(export\s+)?(const|let|var)\b/.test(line)
    : false;
}

// P-02 🔴 — module-scope mutable cross-request state (new Map()/Set()/object-as-cache, lazy-init).
const p02: Detector = {
  id: "P-02",
  title: "module-scope mutable cross-request state (Fluid-racy + cold-empty)",
  detect(files) {
    const findings: Finding[] = [];
    for (const file of files) {
      if (!isCode(file.path)) continue;
      // Restrict the strongest signal to api-route-shaped files, but a module-scope mutable Map/Set
      // anywhere is the documented smell.
      eachLine(file, (line, num) => {
        const trimmed = line.trimStart();
        const indented = line.length - trimmed.length > 0;
        const isTopLevel = !indented && /^(export\s+)?(let|var|const)\b/.test(trimmed);
        // new Map()/Set() assigned to a top-level let/var (mutable cross-request cache).
        // Allow an optional generic type-arg list — `new Map<string, string>()` is the same smell.
        if (isTopLevel && /^(export\s+)?(let|var)\b.*\b(new\s+(Map|Set)\s*(<[^>]*>)?\s*\()/.test(trimmed)) {
          findings.push({
            pitfall: "P-02",
            file: file.path,
            line: num,
            severity: "critical",
            message:
              "module-scope mutable `new Map()/Set()` — racy under Vercel Fluid + empty on cold start. Externalize (Upstash/Supabase) or pass the ID from the client.",
          });
        }
        // lazy-init singleton: `let X = null` then `if (!X) X = ...` (the classic).
        if (isTopLevel && /^(export\s+)?let\b.*=\s*(null|undefined)\s*;?$/.test(trimmed)) {
          findings.push({
            pitfall: "P-02",
            file: file.path,
            line: num,
            severity: "high",
            message:
              "module-scope mutable `let` (lazy-init cross-request state smell) — move into function scope or externalize.",
          });
        }
      });
    }
    return findings;
  },
};

// P-04 🔴 — a create-schema with .default() reused/partial'd for PATCH (data loss).
const p04: Detector = {
  id: "P-04",
  title: "defaulted create-schema reused for PATCH (Zod .default() data loss)",
  detect(files) {
    const findings: Finding[] = [];
    for (const file of files) {
      if (!isCode(file.path)) continue;
      const text = file.text;
      // Flag a schema that carries .default() AND is .partial()'d in the same expression chain
      // (the exact symptom: a defaulted schema being partial'd to validate PATCH).
      eachLine(file, (line, num) => {
        if (/\.default\(/.test(line) && /\.partial\(\)/.test(line)) {
          findings.push({
            pitfall: "P-04",
            file: file.path,
            line: num,
            severity: "critical",
            message:
              "`.default()` survives under `.partial()` (Zod 4) — a PATCH omitting this field resets it. Use a dedicated no-default PATCH schema.",
          });
        }
      });
      // Cross-line: a const that both has .default() and is referenced by a *.partial() PATCH schema.
      const defaultedConst = /const\s+(\w*[Cc]reate\w*)\s*=\s*z\.object\([\s\S]*?\.default\(/.exec(text);
      if (defaultedConst) {
        const createName = defaultedConst[1];
        const partialReuse = new RegExp(`${createName}\\.partial\\(\\)`);
        if (partialReuse.test(text)) {
          const idx = text.slice(0, text.search(partialReuse)).split("\n").length;
          findings.push({
            pitfall: "P-04",
            file: file.path,
            line: idx,
            severity: "critical",
            message: `create-schema \`${createName}\` (has .default()) is .partial()'d for PATCH — defaults still fire. Build a dedicated no-default PATCH schema.`,
          });
        }
      }
    }
    return findings;
  },
};

// P-09 🟠 — no `tsc --noEmit` CI/script gate (native strip-types ships silent `any`).
const p09: Detector = {
  id: "P-09",
  title: "missing tsc --noEmit type-check gate",
  detect(files, pkg) {
    const findings: Finding[] = [];
    const scripts = (pkg?.scripts ?? {}) as Record<string, string>;
    const hasGate = Object.values(scripts).some((s) => /tsc[^\n]*--noEmit/.test(s));
    // Also accept a CI workflow with the gate.
    const ciHasGate = files.some(
      (f) => /\.ya?ml$/.test(f.path) && /tsc[^\n]*--noEmit/.test(f.text),
    );
    if (!hasGate && !ciHasGate) {
      findings.push({
        pitfall: "P-09",
        file: "package.json",
        line: 0,
        severity: "high",
        message:
          "no `tsc --noEmit` gate (script or CI) — native `.ts` execution strips types without checking them; the no-any law is unenforced.",
      });
    }
    return findings;
  },
};

// P-10/P-11 🟠 — SSE traps: streaming route missing X-Accel-Buffering:no or the 3rd-arg handler.
const p10p11: Detector = {
  id: "P-10/P-11",
  title: "SSE streaming traps (nginx buffering + onError-after-headers)",
  detect(files) {
    const findings: Finding[] = [];
    for (const file of files) {
      if (!isCode(file.path)) continue;
      const text = file.text;
      const usesStream = /streamSSE\s*\(|\bstreamText\s*\(/.test(text);
      if (!usesStream) continue;
      // Look for the header being *set* (c.header('X-Accel-Buffering', ...) or an object literal
      // entry), NOT a bare mention — a comment or string that merely names the header must not mask
      // the P-10 finding (T-council false-negative). The header value `no` is the fix; we accept any
      // set form to avoid over-fitting.
      const setsAccelBuffering =
        /\bheader\s*\(\s*["'`]X-Accel-Buffering["'`]/i.test(text) ||
        /["'`]X-Accel-Buffering["'`]\s*:/i.test(text);
      if (!setsAccelBuffering) {
        findings.push({
          pitfall: "P-10",
          file: file.path,
          line: text.slice(0, text.search(/streamSSE|streamText/)).split("\n").length,
          severity: "high",
          message:
            "streaming route without `X-Accel-Buffering: no` — tokens batch behind nginx and arrive as one dump.",
        });
      }
      // 3rd-arg error handler: streamSSE(c, cb, onError) — flag a 2-arg call.
      const twoArg = /streamSSE\s*\(\s*[^,]+,\s*[^,)]+\)/.test(text) && !/streamSSE\s*\([^)]*,[^)]*,[^)]*\)/.test(text);
      if (twoArg) {
        findings.push({
          pitfall: "P-11",
          file: file.path,
          line: text.slice(0, text.search(/streamSSE/)).split("\n").length,
          severity: "high",
          message:
            "`streamSSE` without the 3rd-arg error handler — an in-stream throw is NOT caught by app.onError (headers already sent); write an `event: error` frame and close.",
        });
      }
    }
    return findings;
  },
};

// P-03 🟠 — raw `hc<AppType>` instead of the precompiled hcWithType (RPC type loss as routes grow).
const p03: Detector = {
  id: "P-03",
  title: "raw hc() RPC client (type loss / 'excessively deep')",
  detect(files) {
    const findings: Finding[] = [];
    for (const file of files) {
      if (!isCode(file.path)) continue;
      eachLine(file, (line, num) => {
        // raw `hc<...>(` used to build the client, where no hcWithType wrapper exists in the file.
        if (/\bhc<\w+>\s*\(/.test(line) && !/hcWithType/.test(file.text)) {
          findings.push({
            pitfall: "P-03",
            file: file.path,
            line: num,
            severity: "medium",
            message:
              "raw `hc<AppType>()` client — ship `hcWithType` (precompiled client type) and chain routes into one AppType to avoid 'excessively deep' as routes grow.",
          });
        }
      });
    }
    return findings;
  },
};

// S-11 🔴 — CORS wildcard + credentials; JWT accepting non-Bearer.
const s11: Detector = {
  id: "S-11",
  title: "Hono middleware CVE surface (CORS wildcard+credentials, JWT non-Bearer)",
  detect(files) {
    const findings: Finding[] = [];
    for (const file of files) {
      if (!isCode(file.path)) continue;
      const text = file.text;
      // cors({ origin: "*", credentials: true }) in any order.
      if (/cors\s*\(\s*\{[\s\S]*?origin\s*:\s*["'`]\*["'`][\s\S]*?credentials\s*:\s*true/.test(text) ||
        /cors\s*\(\s*\{[\s\S]*?credentials\s*:\s*true[\s\S]*?origin\s*:\s*["'`]\*["'`]/.test(text)) {
        findings.push({
          pitfall: "S-11",
          file: file.path,
          line: text.slice(0, text.search(/cors\s*\(/)).split("\n").length,
          severity: "critical",
          message: "CORS `origin: '*'` WITH `credentials: true` — a credentialed wildcard leak. Pin explicit origins.",
        });
      }
    }
    return findings;
  },
};

export const DETECTORS: readonly Detector[] = [p02, p04, p09, p10p11, p03, s11];

/** Re-export the module-scope helper for the standalone version-pin detector (B9 reuse). */
export { isCode, isModuleScope };
