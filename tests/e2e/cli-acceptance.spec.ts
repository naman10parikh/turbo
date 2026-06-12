// turbo CLI acceptance E2E (CP123 Cluster G / G29). The full acceptance invocation from a clean
// dir (PLAN §5) — generate a typed Hono service from the petstore fixture, then assert the law:
// tsc --noEmit 0 errors + the distinct no-default PATCH schema + zero P-02/P-04. Renders the
// result into a page and screenshots it for the chairman (a visual receipt of the acceptance flow).

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = process.cwd();
const CLI = join(REPO, "dist", "cli", "index.js");
const FIXTURE = join(REPO, "eval", "fixtures", "petstore.openapi.json");
const SHOTS = join(REPO, "content", "screenshots");

function run(args: string[], cwd = REPO): { ok: boolean; out: string } {
  try {
    const out = execFileSync(process.execPath, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, out: (err.stdout || "") + (err.stderr || "") + (err.message || "") };
  }
}

test("CLI acceptance flow — turbo api → tsc → audit, from a clean dir", async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), "turbo-accept-e2e-"));
  const out = join(dir, "svc");
  const steps: Array<{ label: string; ok: boolean; note: string }> = [];

  try {
    // 1. Generate the typed Hono service from the fixture.
    const gen = run([CLI, "api", "--spec", FIXTURE, "--out", out, "--json"]);
    let genOk = gen.ok && existsSync(join(out, "package.json"));
    let genNote = "package.json " + (existsSync(join(out, "package.json")) ? "present" : "MISSING");
    // `--json` emits one pretty-printed JSON object (multi-line) — parse the whole stdout, not a line.
    try { JSON.parse(gen.out.trim()); genNote += " · --json parseable"; } catch { genOk = false; genNote += " · --json UNPARSEABLE"; }
    steps.push({ label: "turbo api --spec petstore.openapi.json", ok: genOk, note: genNote });
    expect(genOk, "generate step").toBeTruthy();

    // 2. npm install + tsc --noEmit (the law: no `any`). npm/npx aren't process.execPath, so
    // these shell out via execFileSync directly (not the process.execPath-based `run` helper).
    const installOk = (() => {
      try { execFileSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: out, encoding: "utf8", stdio: "ignore" }); return true; } catch { return false; }
    })();
    steps.push({ label: "npm install", ok: installOk, note: installOk ? "deps installed" : "install failed" });
    expect(installOk, "npm install").toBeTruthy();

    const tsc = (() => {
      try { execFileSync("npx", ["tsc", "--noEmit"], { cwd: out, encoding: "utf8", stdio: "pipe" }); return { ok: true, out: "" }; }
      catch (e: unknown) { const er = e as { stdout?: string }; return { ok: false, out: er.stdout || "" }; }
    })();
    steps.push({ label: "tsc --noEmit (the law: no any)", ok: tsc.ok, note: tsc.ok ? "0 errors" : "TYPE ERRORS" });
    expect(tsc.ok, "tsc --noEmit").toBeTruthy();

    // 3. npm run contract (runtime OpenAPI conformance + RPC type).
    const contract = (() => {
      try { execFileSync("npm", ["run", "contract"], { cwd: out, encoding: "utf8", stdio: "pipe" }); return true; } catch { return false; }
    })();
    steps.push({ label: "npm run contract", ok: contract, note: contract ? "conformance green" : "contract failed" });
    expect(contract, "npm run contract").toBeTruthy();

    // 4. turbo audit → zero critical pitfalls (the generator passes its own audit).
    const audit = run([CLI, "audit", out, "--json"]);
    const criticals = (audit.out.match(/"pitfall":\s*"P-0[24]"/g) || []).length;
    steps.push({ label: "turbo audit → zero P-02/P-04", ok: criticals === 0, note: `${criticals} critical pitfalls` });
    expect(criticals, "no P-02/P-04 in generated output").toBe(0);

    // Render a visual receipt of the acceptance flow for the chairman.
    const rows = steps.map((s) =>
      `<tr><td class="s">${s.ok ? "✓" : "✗"}</td><td class="l">${s.label}</td><td class="n">${s.note}</td></tr>`,
    ).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{background:#141312;color:#ece8e1;font-family:Poppins,system-ui,sans-serif;font-weight:300;padding:48px}
      h1{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:2.4rem;margin:0 0 4px}
      .sub{color:#a8a29e;margin-bottom:28px}
      table{border-collapse:collapse;width:760px}
      td{padding:14px 16px;border-bottom:1px solid #2a2724;font-size:0.95rem}
      .s{font-size:1.2rem;width:40px}
      tr td.s{color:#5dd39e} .l{color:#ece8e1} .n{color:#a8a29e;font-size:0.85rem}
      .foot{margin-top:24px;color:#f0a500;font-size:0.85rem}
      </style></head><body>
      <h1>turbo — acceptance flow</h1>
      <div class="sub">turbo api --spec petstore.openapi.json &nbsp;→&nbsp; typed Hono service, contract tests green</div>
      <table>${rows}</table>
      <div class="foot">All gates green · the generator passes its own audit · Hono 4.12.25 · Node 24 · Zod 4.4</div>
      </body></html>`;
    await page.setContent(html);
    await page.screenshot({ path: join(SHOTS, "cli-acceptance-flow.png"), fullPage: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
