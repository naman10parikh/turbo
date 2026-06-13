/**
 * boot-test — the E2B sandbox-boot integration (E22, the real Sandbox/Infra integration point).
 *
 * The acceptance test's risky integration point per HARNESS-OVERRIDES §11: a generated Hono service is
 * ACTUALLY booted in an E2B Firecracker microVM, `/health`→200 is MEASURED against a live port, the
 * contract is checked against the live boot, and the sandbox is torn down. Graded on the live boot itself.
 *
 * Run:  node eval/sandbox/boot-test.ts            (standalone — native strip-types; no relative .ts imports)
 * Skip: if E2B_API_KEY is unset → SKIP cleanly (rc 0) and note it (Q0 — the merge gate does NOT depend on
 *       E2B; the non-sandbox acceptance path still gates). Otherwise → boot, assert, tear down.
 *
 * Boot path (load-bearing — see E21's finding): the generated `start` is `node src/main.ts`, which FAILS
 * under native Node (amaro strips types but does NOT rewrite `.js`→`.ts` import specifiers). So we
 * `npm install` → `npm run build` (tsc → dist/*.js) → `node dist/src/main.js` inside the sandbox. The
 * default E2B template ships Node 20; the COMPILED output is plain ES2023 JS that boots there fine.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = process.cwd();
const PORT = 3000;
const COLD_START_BUDGET_MS = 500; // the ≤500ms cold-start gate (measured, logged — not merge-blocking)

/** Resolve the built turbo CLI (dist/cli/index.js) from the repo root. */
function cliEntry(): string {
  return join(REPO_ROOT, "dist", "cli", "index.js");
}

/**
 * Best-effort: read one key from the repo's gitignored `.env` if it isn't already in the process env.
 * The secrets manifest (PLAN §8) documents the E2B key living in `.env`, but a bare
 * `node eval/sandbox/boot-test.ts` does not auto-load it — so without this, the documented path
 * silently SKIPs instead of booting. No new deps; a minimal `KEY=value` line parse (quotes stripped).
 */
function envFromDotenv(key: string): string | undefined {
  if (process.env[key] && process.env[key]!.trim().length > 0) return process.env[key];
  try {
    const raw = readFileSync(join(REPO_ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env file — fall through to undefined (clean-skip path handles it)
  }
  return undefined;
}

/** Recursively collect a generated service's source files as {rel, text}, skipping node_modules/dist/.git. */
function collectFiles(root: string): Array<{ rel: string; text: string }> {
  const out: Array<{ rel: string; text: string }> = [];
  const skip = new Set(["node_modules", "dist", ".git"]);
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const full = join(dir, name);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else out.push({ rel: relative(root, full), text: readFileSync(full, "utf8") });
    }
  };
  walk(root);
  return out;
}

async function main(): Promise<number> {
  const apiKey = envFromDotenv("E2B_API_KEY");
  if (!apiKey || apiKey.trim().length === 0) {
    console.log("⏭  E2B_API_KEY unset — SKIP the sandbox-boot eval (Q0: the merge gate does not depend on E2B).");
    console.log("   The non-sandbox acceptance path (E23) still gates the merge. To enable: set E2B_API_KEY.");
    console.log("SANDBOX_BOOT=skipped");
    return 0; // clean skip, NOT a failure
  }

  // 1) Generate the petstore service locally (the artifact we boot).
  const spec = join(REPO_ROOT, "eval", "fixtures", "petstore.openapi.json");
  const svcDir = join(mkdtempSync(join(tmpdir(), "turbo-e2b-")), "service");
  const gen = spawnSync(process.execPath, [cliEntry(), "api", "--spec", spec, "--out", svcDir], {
    encoding: "utf8",
    env: process.env,
  });
  if (gen.status !== 0) {
    console.error(`✗ turbo api (generate) failed: ${(gen.stderr || gen.stdout || "").slice(0, 300)}`);
    return 1;
  }
  const files = collectFiles(svcDir);
  console.log(`generated ${files.length} files → booting in E2B…`);

  // 2) Dynamic import so a missing SDK degrades to a clear message, not a module-load crash.
  let Sandbox: typeof import("e2b").Sandbox;
  try {
    ({ Sandbox } = await import("e2b"));
  } catch (e) {
    console.error(`✗ e2b SDK not installed: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }

  let sbx: import("e2b").Sandbox | undefined;
  try {
    // 3) Create the sandbox — measure cold start.
    const t0 = Date.now();
    sbx = await Sandbox.create({ timeoutMs: 120_000, apiKey });
    const coldMs = Date.now() - t0;
    console.log(`SANDBOX_CREATED id=${sbx.sandboxId} cold_start_ms=${coldMs}`);

    // 4) Upload the generated tree into /home/user/svc.
    const base = "/home/user/svc";
    for (const f of files) {
      await sbx.files.write(`${base}/${f.rel}`, f.text);
    }

    // 5) Install + build (tsc → dist/*.js) — the compiled output boots on the template's Node.
    const install = await sbx.commands.run(`cd ${base} && npm install --no-audit --no-fund`, { timeoutMs: 120_000 });
    if (install.exitCode !== 0) {
      console.error(`✗ npm install in sandbox failed (exit ${install.exitCode}): ${(install.stderr || "").slice(0, 300)}`);
      return 1;
    }
    const build = await sbx.commands.run(`cd ${base} && npm run build`, { timeoutMs: 120_000 });
    if (build.exitCode !== 0) {
      console.error(`✗ npm run build in sandbox failed (exit ${build.exitCode}): ${(build.stderr || "").slice(0, 300)}`);
      return 1;
    }

    // 6) Boot the COMPILED entry in the background (node dist/src/main.js).
    void sbx.commands.run(`cd ${base} && PORT=${PORT} node dist/src/main.js`, { background: true, timeoutMs: 90_000 });

    // 7) Resolve the public host and poll /health on the LIVE port.
    const host = await sbx.getHost(PORT);
    const healthUrl = `https://${host}/health`;
    console.log(`live host: ${host}`);

    let healthOk = false;
    let healthBody = "";
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(healthUrl);
        if (res.status === 200) {
          healthBody = await res.text();
          healthOk = true;
          break;
        }
      } catch {
        // not ready yet — keep polling
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!healthOk) {
      console.error("✗ /health never returned 200 on the live E2B port");
      return 1;
    }
    // Contract-conformant body: /health serves {"status":"ok"}.
    let parsed: { status?: string };
    try {
      parsed = JSON.parse(healthBody) as { status?: string };
    } catch {
      console.error(`✗ /health body is not JSON: ${healthBody.slice(0, 120)}`);
      return 1;
    }
    if (parsed.status !== "ok") {
      console.error(`✗ /health body not contract-conformant (expected {status:"ok"}): ${healthBody.slice(0, 120)}`);
      return 1;
    }

    // The contract: /openapi.json serves a conformant 3.x document on the live boot.
    const openapiRes = await fetch(`https://${host}/openapi.json`);
    if (openapiRes.status !== 200) {
      console.error(`✗ /openapi.json returned ${openapiRes.status} on the live port`);
      return 1;
    }
    const doc = (await openapiRes.json()) as { openapi?: string; paths?: Record<string, unknown> };
    if (!doc.openapi || !/^3\./.test(doc.openapi) || !doc.paths || Object.keys(doc.paths).length === 0) {
      console.error("✗ /openapi.json is not a conformant 3.x document on the live boot");
      return 1;
    }

    console.log(`LIVE /health → 200 {"status":"ok"}; /openapi.json → 200 (openapi ${doc.openapi}, ${Object.keys(doc.paths).length} paths)`);
    console.log(`COLD_START_MS=${coldMs} (budget ${COLD_START_BUDGET_MS}ms — ${coldMs <= COLD_START_BUDGET_MS ? "MET" : "OVER (logged, not merge-blocking)"})`);
    console.log(`SANDBOX_RUN_ID=${sbx.sandboxId}`);
    console.log("SANDBOX_BOOT=passed");
    return 0;
  } catch (e) {
    console.error(`✗ E2B boot-test error: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  } finally {
    if (sbx) {
      try {
        await sbx.kill();
        console.log("SANDBOX_TORN_DOWN=true");
      } catch (e) {
        console.error(`! sandbox teardown warning: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}

// Pin the working directory note for the relative resolutions above.
void dirname(fileURLToPath(import.meta.url));

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`✗ boot-test fatal: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
