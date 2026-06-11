/**
 * version-oracle — the engine behind `turbo check` (B9): the version-drift + EOL + security-floor
 * oracle that powers the RSI loop (D17).
 *
 * Strategy:
 *  1. Read the pinned versions out of `brain/TOOL-MATRIX.md` (so a planted stale pin in a copy of
 *     the matrix is detected — B9's verify).
 *  2. For each pinned package, ask npm for the current version (`npm view <pkg> version`).
 *  3. Flag: drift (pin < current), the Hono security floor (<4.12.16 = vulnerable), and EOL runtimes
 *     (Node 20 class) read from the matrix prose.
 *  4. Offline-safe: every `npm view` has a short timeout and falls back to a local "last-known-current"
 *     table, so the command never hangs (the chaos-test: no-network → degrade, don't hang).
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";

/** The npm packages turbo pins + watches (the brain's default stack). */
export const WATCHED_PACKAGES = [
  "hono",
  "zod",
  "@hono/zod-openapi",
  "@orpc/server",
  "neverthrow",
  "vitest",
] as const;

/** Last-known-current versions (the offline fallback table — refreshed by the RSI loop). */
const LAST_KNOWN_CURRENT: Record<string, string> = {
  hono: "4.12.25",
  zod: "4.4.3",
  "@hono/zod-openapi": "1.4.0",
  "@orpc/server": "1.14.5",
  neverthrow: "8.2.0",
  vitest: "2.0.0",
};

/** The Hono security floor — below this is the CVE-vulnerable wave (S-11). */
const HONO_SECURITY_FLOOR = "4.12.16";

export interface PinFinding {
  readonly pkg: string;
  readonly pinned: string | null;
  readonly current: string | null;
  readonly source: "npm" | "local-fallback";
  readonly status: "ok" | "stale" | "vulnerable" | "unknown";
  readonly note?: string;
}

export interface CheckResult {
  readonly online: boolean;
  readonly findings: readonly PinFinding[];
  readonly eolRuntimes: readonly string[];
}

/** Strip a semver range prefix (`^`, `~`, `>=`, `≥`) → a bare `x.y.z`. */
function bareVersion(v: string): string | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

/** Numeric semver compare: -1 if a<b, 0 if equal, 1 if a>b. */
export function cmpSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10));
  const pb = b.split(".").map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * Parse pinned versions out of the TOOL-MATRIX markdown — ONLY from structured pin cells, not prose.
 *
 * A pin is a table row whose package-name cell is **bold-wrapped** (`**Hono**`, `**neverthrow**`) or
 * a scoped name (`@hono/zod-openapi`, `@orpc/server`), followed by the FIRST `x.y.z` version after
 * the name on that line. Prose mentions (e.g. the `w3cj/hono-open-api-starter` row that name-drops
 * `Hono+zod-openapi` next to a *different* package's version) are ignored — they are not bold pin
 * cells, so they never set a pin. Returns the LOWEST version found per package, so a planted stale
 * pin in a copy of the matrix is what gets flagged (B9's verify).
 */
export function parseMatrixPins(matrixText: string): Record<string, string> {
  const pins: Record<string, string> = {};
  const lines = matrixText.split("\n");
  for (const pkg of WATCHED_PACKAGES) {
    const esc = pkg.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    // Match the name as a PIN CELL only:
    //  - scoped `@scope/name` (already unambiguous), or
    //  - `**name**` bold-wrapped (the brain's pin-cell convention) for unscoped names.
    // This deliberately excludes bare prose mentions like `Hono+zod-openapi`.
    const cellRe = pkg.startsWith("@")
      ? new RegExp(esc)
      : new RegExp(`\\*\\*\`?${esc}\`?\\*\\*`, "i");
    for (const line of lines) {
      const at = line.search(cellRe);
      if (at < 0) continue;
      // The version is the first x.y.z AFTER the pin cell on the same line.
      const after = line.slice(at);
      const v = /(\d+)\.(\d+)\.(\d+)/.exec(after);
      if (!v) continue;
      const version = `${v[1]}.${v[2]}.${v[3]}`;
      if (!pins[pkg] || cmpSemver(version, pins[pkg]) < 0) pins[pkg] = version;
    }
  }
  return pins;
}

/** Detect EOL runtimes named in the matrix prose (the Node-20 class). */
function detectEolRuntimes(matrixText: string): string[] {
  const eol: string[] = [];
  if (/node\s*20[^0-9]*(eol|end of life|maintenance ended)/i.test(matrixText) ||
    /\bnode 20\b/i.test(matrixText)) {
    // The brain documents Node 20 as EOL (P-01). turbo never pins it.
    eol.push("node-20 (EOL 2026-04-30 — floor is Node 22, default Node 24; P-01)");
  }
  return eol;
}

/** `npm view <pkg> version` with a short timeout; resolves null on any failure (offline-safe). */
function npmViewVersion(pkg: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolveP) => {
    const child = execFile(
      "npm",
      ["view", pkg, "version"],
      { timeout: timeoutMs, windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolveP(null);
          return;
        }
        const v = bareVersion(stdout.trim());
        resolveP(v);
      },
    );
    // Guard: if execFile's timeout doesn't fire (rare), force-resolve.
    child.on("error", () => resolveP(null));
  });
}

/**
 * Run the full check: read matrix pins, query npm (with offline fallback), flag drift + floor + EOL.
 * `timeoutMs` bounds each npm call so the whole command stays well under ~5s even with no network.
 */
export async function runVersionCheck(
  matrixPath: string,
  opts: { timeoutMs?: number } = {},
): Promise<CheckResult> {
  const timeoutMs = opts.timeoutMs ?? 2500;
  let matrixText = "";
  try {
    matrixText = readFileSync(matrixPath, "utf8");
  } catch {
    matrixText = "";
  }
  const pins = parseMatrixPins(matrixText);
  const eolRuntimes = detectEolRuntimes(matrixText);

  // Query npm for all watched packages in PARALLEL — each call is independently bounded by
  // `timeoutMs`, so the whole command stays ~one-timeout wide even with no network. (Sequential
  // awaits would stack to N×timeout — 6×2.5s≈15s offline, blowing the "well under ~5s" bound.)
  const liveVersions = await Promise.all(WATCHED_PACKAGES.map((pkg) => npmViewVersion(pkg, timeoutMs)));

  let anyOnline = false;
  const findings: PinFinding[] = [];
  WATCHED_PACKAGES.forEach((pkg, i) => {
    const pinned = pins[pkg] ?? null;
    const live = liveVersions[i] ?? null;
    const current = live ?? LAST_KNOWN_CURRENT[pkg] ?? null;
    const source: "npm" | "local-fallback" = live ? "npm" : "local-fallback";
    if (live) anyOnline = true;

    let status: PinFinding["status"] = "unknown";
    let note: string | undefined;
    if (pinned && current) {
      if (pkg === "hono" && cmpSemver(pinned, HONO_SECURITY_FLOOR) < 0) {
        status = "vulnerable";
        note = `Hono pin ${pinned} < security floor ${HONO_SECURITY_FLOOR} (CVE wave — S-11). Bump to ≥4.12.25.`;
      } else if (cmpSemver(pinned, current) < 0) {
        status = "stale";
        note = `pinned ${pinned} < current ${current} (${source}) — drift.`;
      } else {
        status = "ok";
      }
    } else if (!pinned) {
      note = "no pin found in TOOL-MATRIX.md for this package.";
    }

    findings.push({ pkg, pinned, current, source, status, ...(note ? { note } : {}) });
  });

  return { online: anyOnline, findings, eolRuntimes };
}
