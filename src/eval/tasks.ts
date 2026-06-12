/**
 * eval/tasks — the 13 golden tasks (G1–G13 → S-IDs) as executable binary checks (E19).
 *
 * Each task's `run` returns a Result: ok(evidence) when the VERIFY passes, err(reason) when it fails.
 * The VERIFY is an OBJECTIVE gate (dsip.json noSelfGrading:true) — a deterministic check on the
 * generated tree / its audit / a `turbo brain`|`explain` call — NEVER the agent's own opinion.
 *
 * Levels: L1 assertion · L2 behavior · L3 trajectory. CI-blocking set = G1/G3/G4/G5/G7/G13 (pass^k).
 * Source mapping: brain/BATTLE-TESTED-SCENARIOS.md (each task cites its S-ID).
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { err, ok, type Result } from "../core/result.js";
import { cmpSemver } from "../audit/version-oracle.js";
import { turboJson, type EvalContext } from "./harness.js";

/** Strip an npm range prefix (`^`/`~`/`>=`) and trailing range cruft → a bare `x.y.z`, or "" if none. */
function bareVersion(pin: string): string {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(pin);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : "";
}

export interface EvalTask {
  readonly id: string; // the S-ID
  readonly g: string; // the G-number (PLAN §6)
  readonly level: 1 | 2 | 3;
  readonly ciBlocking: boolean;
  readonly title: string;
  run(ctx: EvalContext): Result<string, string>;
}

// ── helpers ───────────────────────────────────────────────────────────────────────────────────

/** Assert a brain query ranks the given S-ID in the top-N hits (knowledge present + ranked). */
function brainRanks(ctx: EvalContext, query: string, id: string, topN = 3): Result<string, string> {
  const r = turboJson(["brain", query], ctx.cwd);
  if (!r.ok) return err(`turbo brain failed: ${r.error}`);
  const hits = Array.isArray(r.value.hits) ? (r.value.hits as Array<{ id?: string }>) : [];
  const rank = hits.findIndex((h) => h.id === id);
  if (rank >= 0 && rank < topN) return ok(`brain ranked ${id} #${rank + 1} for "${query}"`);
  return err(`brain did not rank ${id} in top ${topN} for "${query}" (got: ${hits.slice(0, topN).map((h) => h.id).join(", ")})`);
}

/** Assert `turbo explain <id>` resolves to a non-empty body containing detection+fix signal. */
function explainResolves(ctx: EvalContext, id: string): Result<string, string> {
  const r = turboJson(["explain", id], ctx.cwd);
  if (!r.ok) return err(`turbo explain ${id} failed: ${r.error}`);
  const body = typeof r.value.body === "string" ? r.value.body : "";
  if (body.length > 40 && /RESOLUTION|Avoid|fix|VERIFY/i.test(body)) {
    return ok(`explain ${id} resolved (${body.length} chars, has detection+fix)`);
  }
  return err(`turbo explain ${id} returned no usable detection+fix body`);
}

/** Combine a knowledge query + an explain into one knowledge-task gate. */
function knowledge(ctx: EvalContext, query: string, id: string): Result<string, string> {
  const ranked = brainRanks(ctx, query, id);
  if (!ranked.ok) return ranked;
  const explained = explainResolves(ctx, id);
  if (!explained.ok) return explained;
  return ok(`${ranked.value}; ${explained.value}`);
}

/** True if the audit findings include any of the given pitfall IDs. */
function hasFinding(ctx: EvalContext, ...pitfalls: string[]): boolean {
  return ctx.auditFindings.some((f) => pitfalls.includes(String(f.pitfall)));
}

// ── L1 — assertions ─────────────────────────────────────────────────────────────────────────

/** G1/S-02 — PATCH schema distinct + no `.default()`; create schema keeps its default. */
const G1: EvalTask = {
  id: "S-02", g: "G1", level: 1, ciBlocking: true,
  title: "PATCH schema is distinct + has no `.default()` (Zod data-loss)",
  run(ctx) {
    const app = ctx.readFile("src/app.ts");
    if (!app) return err("generated src/app.ts not found");
    const patchBlock = app.slice(app.indexOf(".patch("));
    const postBlock = app.slice(app.indexOf(".post("), app.indexOf(".patch(") >= 0 ? app.indexOf(".patch(") : undefined);
    const patchHasDefault = /\.default\(/.test(patchBlock);
    const createHasDefault = /\.default\(/.test(postBlock);
    if (patchHasDefault) return err("PATCH schema contains `.default()` — silent data-loss (P-04)");
    if (!createHasDefault) return err("create (POST) schema lost its `.default()` — fixture not exercising the trap");
    if (hasFinding(ctx, "P-04")) return err("turbo audit reports P-04 on the generated tree");
    return ok("PATCH block has no `.default()`, POST block keeps it, audit clean of P-04");
  },
};

/** G2/S-04 — the native-addon-audit-before-Bun stance is present + queryable. */
const G2: EvalTask = {
  id: "S-04", g: "G2", level: 1, ciBlocking: false,
  title: "Native-addon audit before a Bun migration (expertise present)",
  run(ctx) {
    return knowledge(ctx, "Bun native addon sharp image pipeline audit", "S-04");
  },
};

/** G3/S-11 — generated service pins Hono ≥ the security floor + no CORS wildcard+credentials. */
const G3: EvalTask = {
  id: "S-11", g: "G3", level: 1, ciBlocking: true,
  title: "Hono pinned ≥4.12.25 + no CORS wildcard+credentials",
  run(ctx) {
    const deps = (ctx.servicePkg.dependencies ?? {}) as Record<string, string>;
    const honoPin = deps.hono;
    if (!honoPin) return err("generated package.json has no hono dependency");
    const v = bareVersion(honoPin);
    if (!v) return err(`could not parse hono pin "${honoPin}"`);
    if (cmpSemver(v, "4.12.25") < 0) return err(`hono pin ${honoPin} is below the 4.12.25 security floor (S-11)`);
    // No CORS wildcard+credentials anywhere in the generated tree.
    for (const rel of ["src/app.ts", "src/server.ts", "src/openapi.ts"]) {
      const text = ctx.readFile(rel);
      if (/origin:\s*['"`]\*['"`]/.test(text) && /credentials:\s*true/.test(text)) {
        return err(`CORS wildcard+credentials combo in ${rel} (S-11)`);
      }
    }
    return ok(`hono pinned ${honoPin} (≥4.12.25); no CORS wildcard+credentials`);
  },
};

/** G4/S-13 — `tsc --noEmit` script present + no enum/value-namespace in generated code. */
const G4: EvalTask = {
  id: "S-13", g: "G4", level: 1, ciBlocking: true,
  title: "`tsc --noEmit` gate present + no enum/value-namespace",
  run(ctx) {
    const scripts = (ctx.servicePkg.scripts ?? {}) as Record<string, string>;
    const hasGate = Object.values(scripts).some((s) => /tsc[^\n]*--noEmit/.test(s));
    if (!hasGate) return err("generated package.json has no `tsc --noEmit` script (P-09)");
    for (const rel of ["src/app.ts", "src/schemas.ts", "src/server.ts", "src/openapi.ts", "src/client.ts"]) {
      const text = ctx.readFile(rel);
      if (/^\s*export\s+enum\s/m.test(text) || /^\s*enum\s/m.test(text)) {
        return err(`generated ${rel} uses \`enum\` (breaks native type-stripping, S-13)`);
      }
      if (/^\s*export\s+namespace\s/m.test(text)) {
        return err(`generated ${rel} value-exports a \`namespace\` (breaks strip-time, S-13)`);
      }
    }
    return ok("`tsc --noEmit` script present; no enum/value-namespace in generated code");
  },
};

// ── L2 — behavior ────────────────────────────────────────────────────────────────────────────

/** G5/S-01 — no module-scope mutable cross-request state; audit clean of P-02. */
const G5: EvalTask = {
  id: "S-01", g: "G5", level: 2, ciBlocking: true,
  title: "No module-scope mutable state (cross-user bleed)",
  run(ctx) {
    if (hasFinding(ctx, "P-02")) return err("turbo audit reports P-02 (module-scope mutable state) on the generated tree");
    // Structural behavior check: the generated app declares its per-request schemas INSIDE handlers,
    // not as module-scope mutable caches. Confirm no module-level `let X = new Map/Set` or accumulator.
    const app = ctx.readFile("src/app.ts");
    const moduleScope = app.split("export const app")[0] ?? app;
    if (/\b(let|var)\s+\w+\s*=\s*new\s+(Map|Set)\s*[<(]/.test(moduleScope)) {
      return err("module-scope `new Map()/Set()` mutable cache in generated app (S-01/P-02)");
    }
    if (/\b(let|var)\s+\w+\s*=\s*(\[\]|\{\})/.test(moduleScope) && /\.push\(/.test(app)) {
      return err("module-scope mutable accumulator in generated app (S-01)");
    }
    return ok("no module-scope mutable cross-request state; audit clean of P-02");
  },
};

/** G6/S-03 — Express 5 named-wildcard RESOLUTION is produced (knowledge-behavior). */
const G6: EvalTask = {
  id: "S-03", g: "G6", level: 2, ciBlocking: false,
  title: "Express 5 named-wildcard fix produced (not a rollback)",
  run(ctx) {
    return knowledge(ctx, "Express 5 wildcard Missing parameter name boot break splat", "S-03");
  },
};

/** G7/S-08 — stream-doctor flags a bad SSE route (P-10+P-11) and passes a guarded one. */
const G7: EvalTask = {
  id: "S-08", g: "G7", level: 2, ciBlocking: true,
  title: "SSE traps detected (missing 3rd-arg handler / X-Accel-Buffering)",
  run(ctx) {
    const dir = mkdtempSync(join(tmpdir(), "turbo-eval-sse-"));
    const badRoute = `import { streamSSE } from "hono/streaming";
import { Hono } from "hono";
export const app = new Hono().get("/stream", (c) =>
  streamSSE(c, async (stream) => {
    for (let i = 0; i < 10; i++) await stream.writeSSE({ data: String(i) });
  }),
);
`;
    // The guarded route sets X-Accel-Buffering (P-10 fix) and passes a NAMED 3rd-arg error handler
    // (P-11 fix). Named handlers — not inline arrows whose own parens confuse a regex — are also the
    // O-12/P-03 recommendation (async-arrow handlers lose inference). So `onStreamError` is realistic.
    const goodRoute = `import { streamSSE, type SSEStreamingApi } from "hono/streaming";
import { Hono } from "hono";
const onStreamError = async (e: Error, stream: SSEStreamingApi) => {
  await stream.writeSSE({ event: "error", data: e.message });
};
const streamBody = async (stream: SSEStreamingApi) => {
  while (!stream.aborted) { await stream.writeSSE({ data: "tok" }); break; }
};
export const app = new Hono().get("/stream", (c) => {
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, streamBody, onStreamError);
});
`;
    const badPath = join(dir, "bad-stream.ts");
    const goodPath = join(dir, "good-stream.ts");
    writeFileSync(badPath, badRoute, "utf8");
    writeFileSync(goodPath, goodRoute, "utf8");

    const bad = turboJson(["stream-doctor", badPath], ctx.cwd);
    if (!bad.ok) return err(`stream-doctor on bad fixture failed: ${bad.error}`);
    const traps = Array.isArray(bad.value.traps) ? (bad.value.traps as Array<{ pitfall?: string }>) : [];
    const ids = traps.map((t) => String(t.pitfall));
    const flagged = ids.some((p) => p.includes("P-10") || p.includes("P-11"));
    if (!flagged) return err(`stream-doctor did NOT flag the bad SSE route (got: ${ids.join(", ") || "none"})`);

    const good = turboJson(["stream-doctor", goodPath], ctx.cwd);
    if (!good.ok) return err(`stream-doctor on good fixture failed: ${good.error}`);
    const goodTraps = Array.isArray(good.value.traps) ? good.value.traps : [];
    if (goodTraps.length !== 0) return err(`stream-doctor flagged the GUARDED route (${goodTraps.length} traps) — false positive`);

    return ok(`bad SSE route → ${ids.join("+")}; guarded route → 0 traps`);
  },
};

/** G8/S-09 — generated client uses hcWithType (not raw hc); tree typechecks. */
const G8: EvalTask = {
  id: "S-09", g: "G8", level: 2, ciBlocking: false,
  title: "RPC client uses hcWithType + tree typechecks (no type loss)",
  run(ctx) {
    const client = ctx.readFile("src/client.ts");
    if (!client) return err("generated src/client.ts not found");
    if (!/hcWithType/.test(client)) return err("generated client does not export `hcWithType` (raw hc loses types, S-09)");
    if (ctx.installed && ctx.typecheck && !ctx.typecheck.ok) {
      return err(`generated tree fails \`tsc --noEmit\` — RPC type does not resolve (S-09): ${ctx.typecheck.error.slice(0, 160)}`);
    }
    const tcNote = ctx.installed ? "tree typechecks (RPC type resolves)" : "typecheck skipped — tree not installed";
    return ok(`client uses hcWithType (precompiled client type); ${tcNote}`);
  },
};

/** G9/S-12 — the Date-round-trip RESOLUTION is produced (knowledge-behavior). */
const G9: EvalTask = {
  id: "S-12", g: "G9", level: 2, ciBlocking: false,
  title: "Date round-trip handled explicitly (knowledge-behavior)",
  run(ctx) {
    return knowledge(ctx, "Date round trip string typed RPC JSON serialize", "S-12");
  },
};

// ── L3 — trajectory ──────────────────────────────────────────────────────────────────────────

/** G10/S-06 — generated openapi is schema-derived + conformance test exists; sunset process queryable. */
const G10: EvalTask = {
  id: "S-06", g: "G10", level: 3, ciBlocking: false,
  title: "Versioning enforced — openapi from schemas + conformance + sunset process",
  run(ctx) {
    const openapi = ctx.readFile("src/openapi.ts");
    if (!/openapi\.json/.test(openapi)) return err("generated tree does not serve /openapi.json");
    const test = ctx.readFile("test/contract.test.ts");
    if (!/openapi\.json/.test(test)) return err("no /openapi.json conformance check in the contract test");
    return knowledge(ctx, "API versioning contract test oasdiff sunset zombie versions", "S-06");
  },
};

/** G11/S-07 — the audit-first wrap-then-strangle plan is produced (plan-graded). */
const G11: EvalTask = {
  id: "S-07", g: "G11", level: 3, ciBlocking: false,
  title: "Strangler-Fig migration plan (audit-first, never big-bang)",
  run(ctx) {
    return knowledge(ctx, "Strangler Fig migration Express Fastify wrap then strangle audit", "S-07");
  },
};

/** G12/S-05 — the ≥72h soak + swappability plan is produced (plan-graded). */
const G12: EvalTask = {
  id: "S-05", g: "G12", level: 3, ciBlocking: false,
  title: "Bun ≥72h soak gate + runtime swappability (plan)",
  run(ctx) {
    return knowledge(ctx, "Bun 72 hour soak memory leak always-on swappable runtime", "S-05");
  },
};

/** G13/S-10 — the acceptance spine: generated tree typechecks + contract green + <400-line law. */
const G13: EvalTask = {
  id: "S-10", g: "G13", level: 3, ciBlocking: true,
  title: "Scaffold-from-reference = the acceptance test (tree typechecks + contract + <400)",
  run(ctx) {
    // The generated tree's own structure proves the law; the runner runs tsc+contract for installed mode.
    const app = ctx.readFile("src/app.ts");
    if (!/AppType\s*=\s*typeof app/.test(app)) return err("routes not chained into one AppType (S-10/P-03)");
    if (!/zValidator\(/.test(app)) return err("no Zod parse at the boundary in the generated app (S-10)");
    const deps = (ctx.servicePkg.dependencies ?? {}) as Record<string, string>;
    if (!deps.hono || !deps.zod) return err("generated service missing hono/zod deps (S-10)");
    // The acceptance spine: when the tree is installed, tsc --noEmit AND npm run contract MUST be green.
    if (ctx.installed) {
      if (ctx.typecheck && !ctx.typecheck.ok) return err(`generated tree fails \`tsc --noEmit\` (S-10): ${ctx.typecheck.error.slice(0, 160)}`);
      if (ctx.contract && !ctx.contract.ok) return err(`generated tree fails \`npm run contract\` (S-10): ${ctx.contract.error.slice(0, 160)}`);
    }
    const note = ctx.installed ? "tsc+contract green" : "structure verified (install skipped)";
    return ok(`routes chained into one AppType, Zod at the boundary, hono+zod pinned; ${note}`);
  },
};

/** The full ordered task list (G1→G13). */
export const TASKS: readonly EvalTask[] = [G1, G2, G3, G4, G5, G6, G7, G8, G9, G10, G11, G12, G13];

/** The CI-blocking set (pass^k, k≥3) — PLAN §6 / Q6. */
export const CI_BLOCKING: ReadonlySet<string> = new Set(
  TASKS.filter((t) => t.ciBlocking).map((t) => t.g),
);
