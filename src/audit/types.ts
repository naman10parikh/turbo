/**
 * audit types — the shared shapes for the pitfall-detector framework (B8).
 *
 * Each detector scans a service's files and returns Findings keyed by P-ID. The audit output is
 * `[{ pitfall, file, line, severity, message }]` — deterministic + `--json` (agent-operable).
 */

export type Severity = "critical" | "high" | "medium" | "low";

export interface Finding {
  readonly pitfall: string; // e.g. "P-02"
  readonly file: string; // relative path
  readonly line: number; // 1-based; 0 = whole-file / not line-specific
  readonly severity: Severity;
  readonly message: string;
}

/** A scannable file: relative path + its text contents. */
export interface ScanFile {
  readonly path: string;
  readonly text: string;
}

/** A detector inspects all files (+ optional package.json) and returns findings. */
export interface Detector {
  readonly id: string; // the P-ID it detects
  readonly title: string;
  detect(files: readonly ScanFile[], pkg: Record<string, unknown> | undefined): Finding[];
}
