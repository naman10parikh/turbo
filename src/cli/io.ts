/**
 * io — shared CLI output helpers.
 *
 * Every data command supports `--json` (deterministic, parseable — O-13). `fail` sets a non-zero
 * exit code (the law for agent-operability: exit 0 on success, non-zero on error).
 */

export function emitJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

export function ok(message: string): void {
  process.stdout.write(`✓ ${message}\n`);
}

export function info(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`! ${message}\n`);
}

/** Print an error to stderr and set a non-zero exit code (does not throw — lets the caller return). */
export function fail(message: string): void {
  process.stderr.write(`✗ ${message}\n`);
  process.exitCode = 1;
}
