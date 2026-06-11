/**
 * write-tree — write a generated file map to disk, atomically enough to survive a mid-run kill.
 *
 * Strategy: write the whole tree into a sibling `<out>.tmp-<pid>` dir, then `rename` it into place.
 * A SIGKILL before the rename leaves only the temp dir (never a half-written `<out>` reported as
 * success — the chaos-test invariant). On any error we remove the temp dir (clean up our own mess).
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { err, ok, type Result } from "../core/result.js";

export function writeTree(outDir: string, files: Map<string, string>): Result<string, string> {
  const finalDir = resolve(outDir);
  const tmpDir = `${finalDir}.tmp-${process.pid}`;
  try {
    // Clean any stale destination/temp from a prior aborted run.
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(finalDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });

    for (const [rel, contents] of files) {
      const dest = join(tmpDir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, contents, "utf8");
    }

    // Atomic flip: the tree only "exists" at finalDir once fully written.
    renameSync(tmpDir, finalDir);
    return ok(finalDir);
  } catch (e) {
    // Clean up the partial temp dir — never leave a half-tree masquerading as output.
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn(
        "[write-tree] temp cleanup failed:",
        cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      );
    }
    return err(`write failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
