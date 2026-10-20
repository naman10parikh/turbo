#!/usr/bin/env node
// turbo cockpit — Node stdlib HTTP server (zero npm deps, no build). CP123 Cluster G (G28).
//
// The chairman's read-mostly window into the turbo employee (DECISIONS D3, PLAN §10, Q5).
// turbo is a Node/TS repo, so the "stdlib server" is Node's own `node:http` — not Python like
// the sentinel/talent-intel reference. Same architecture: static SPA + a small JSON API that
// reads the canonical sources (the brain/ markdown, logs/runs.jsonl, the cached eval result).
//
// Read-mostly (Q5): the only CLI it shells out to are the READ-ONLY queries `turbo brain` /
// `turbo explain` (--json). It NEVER triggers a build, scaffold, or audit from the browser —
// those mutating ops belong on the CLI/MCP (the agent surfaces).
//
// Run:  bash scripts/serve.sh            -> http://localhost:7799
// Env:  TURBO_WEB_PORT (default 7799)
//
// Endpoints:
//   GET /                       -> web/index.html (the SPA)
//   GET /app.js | /styles.css   -> static assets
//   GET /api/health             -> { ok, port, ts }
//   GET /api/brain?q=...        -> turbo brain --json (ranked BM25 hits over brain/)
//   GET /api/explain?id=...     -> turbo explain <id> --json (detection+fix for a P-/S-/O-id)
//   GET /api/brain-doc?file=... -> raw markdown of one brain/ artifact (allow-listed)
//   GET /api/runs?limit=N       -> tail of logs/runs.jsonl (parsed, newest-first)
//   GET /api/eval               -> cached eval pyramid result (eval/eval-result.json) + as-of ts

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = __dirname;
const CLI = join(REPO, "dist", "cli", "index.js");
const RUNS = join(REPO, "logs", "runs.jsonl");
const EVAL_CACHE = join(REPO, "eval", "eval-result.json");
const PORT = Number(process.env.TURBO_WEB_PORT || 7799);

// The six brain artifacts the brain-browser renders. Allow-list = no path traversal (the
// energy browser-agent security rule: sanitize before any file read; this is a fixed set).
const BRAIN_FILES = new Set([
  "EXPERTISE-MAP.md",
  "BATTLE-TESTED-SCENARIOS.md",
  "KNOWN-PITFALLS.md",
  "OPINIONS.md",
  "GAPS-AND-DISPUTES.md",
  "TOOL-MATRIX.md",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": buf.length,
    "cache-control": "no-store",
  });
  res.end(buf);
}

async function sendStatic(res, file) {
  try {
    const buf = await readFile(file);
    const ext = file.slice(file.lastIndexOf("."));
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "content-length": buf.length,
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
}

// Shell out to the turbo CLI for a READ-ONLY query. Returns parsed JSON or a typed error
// object (never throws — the law: convert errors at the boundary, no try-catch-swallow-crash).
function runCli(args) {
  return new Promise((resolveP) => {
    execFile(
      process.execPath,
      [CLI, ...args, "--json"],
      { cwd: REPO, timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (!stdout) {
          resolveP({ ok: false, error: err ? err.message : "no output" });
          return;
        }
        try {
          resolveP(JSON.parse(stdout));
        } catch {
          // Non-zero-exit stubs (contract/migrate-plan) print prose, not JSON — surface honestly.
          resolveP({ ok: false, error: "non-json output", raw: stdout.slice(0, 400) });
        }
      },
    );
  });
}

async function tailRuns(limit) {
  try {
    const raw = await readFile(RUNS, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    const parsed = [];
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line));
      } catch {
        // skip a half-written line — the run-logger appends atomically per line, but be safe
      }
    }
    parsed.reverse(); // newest first
    return { ok: true, total: parsed.length, runs: parsed.slice(0, limit) };
  } catch {
    return { ok: true, total: 0, runs: [] };
  }
}

async function evalResult() {
  try {
    const [raw, st] = await Promise.all([readFile(EVAL_CACHE, "utf8"), stat(EVAL_CACHE)]);
    const data = JSON.parse(raw);
    return { ok: true, asOf: st.mtime.toISOString(), result: data };
  } catch {
    // No cache yet — serve.sh refreshes it on boot in the background; tell the UI to wait.
    return { ok: false, asOf: null, result: null, note: "eval cache not built yet — run `node dist/cli/index.js eval --json > eval/eval-result.json`" };
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Read-only API surface only. No POST/PATCH/PUT routes exist (Q5 — read-mostly cockpit).
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "read-only cockpit (Q5) — only GET" });
    return;
  }

  if (path === "/api/health") {
    sendJson(res, 200, { ok: true, port: PORT, ts: new Date().toISOString() });
    return;
  }
  if (path === "/api/brain") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) {
      sendJson(res, 200, { ok: true, query: "", hits: [] });
      return;
    }
    sendJson(res, 200, await runCli(["brain", q]));
    return;
  }
  if (path === "/api/explain") {
    const id = (url.searchParams.get("id") || "").trim();
    if (!/^[A-Za-z]-?\d{1,3}$/.test(id)) {
      sendJson(res, 400, { ok: false, error: "id must look like P-04 / S-02 / O-07 / G1" });
      return;
    }
    sendJson(res, 200, await runCli(["explain", id]));
    return;
  }
  if (path === "/api/brain-doc") {
    const file = url.searchParams.get("file") || "";
    if (!BRAIN_FILES.has(file)) {
      sendJson(res, 400, { ok: false, error: "unknown brain file", allowed: [...BRAIN_FILES] });
      return;
    }
    try {
      const md = await readFile(join(REPO, "brain", file), "utf8");
      sendJson(res, 200, { ok: true, file, markdown: md });
    } catch {
      sendJson(res, 404, { ok: false, error: "brain file not found" });
    }
    return;
  }
  if (path === "/api/runs") {
    const limit = Math.min(Number(url.searchParams.get("limit") || 50) || 50, 500);
    sendJson(res, 200, await tailRuns(limit));
    return;
  }
  if (path === "/api/eval") {
    sendJson(res, 200, await evalResult());
    return;
  }

  // Static SPA.
  if (path === "/" || path === "/index.html") {
    await sendStatic(res, join(WEB, "index.html"));
    return;
  }
  if (path === "/app.js") {
    await sendStatic(res, join(WEB, "app.js"));
    return;
  }
  if (path === "/styles.css") {
    await sendStatic(res, join(WEB, "styles.css"));
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`turbo cockpit on http://127.0.0.1:${PORT}\n`);
});
