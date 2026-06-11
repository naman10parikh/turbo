/**
 * paths — resolve turbo's own packaged resources (the `brain/` corpus, `brain/TOOL-MATRIX.md`)
 * regardless of where the CLI is invoked from.
 *
 * The CLI runs from `dist/cli/...` after build, but `brain/` ships at the package root (it is in
 * package.json `files`). Resolution strategy: prefer `brain/` under the current working directory
 * (running inside the turbo repo — the common dev/CI case), else walk up from this module's location
 * until a directory containing `brain/` is found (running as an installed dependency).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The directory holding turbo's `brain/` corpus. */
export function brainDir(cwd: string = process.cwd()): string {
  // 1) brain/ under the CWD (inside the turbo repo, or a consumer that vendored it).
  const fromCwd = join(cwd, "brain");
  if (existsSync(fromCwd)) return fromCwd;

  // 2) Walk up from this compiled module until we find a sibling `brain/` (installed-dep case).
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "brain");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 3) Fall back to the CWD path even if absent — the caller degrades gracefully (empty corpus).
  return fromCwd;
}

/** The path to a single brain artifact. */
export function brainFile(name: string, cwd: string = process.cwd()): string {
  return join(brainDir(cwd), name);
}
