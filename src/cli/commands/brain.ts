/**
 * `turbo brain <query>` — BM25 ranked search over the six `brain/` artifacts.
 *
 * This IS the Memory component's queryable layer (HARNESS-OVERRIDES §2) — a real ranked search, not
 * grep. Returns the top hits by Okapi BM25 score, each tagged with its file + P-/S-/O- id.
 */
import { loadCorpus, searchCorpus } from "../../memory/bm25.js";
import { brainDir } from "../paths.js";
import { emitJson, fail, info } from "../io.js";
import { logRun } from "../../obs/run-logger.js";

export interface BrainOptions {
  query: string;
  json: boolean;
  limit: number;
}

export function runBrain(opts: BrainOptions): void {
  const start = Date.now();
  const corpus = loadCorpus(brainDir());
  if (corpus.length === 0) {
    logRun({
      command: "brain",
      model: "deterministic",
      duration_ms: Date.now() - start,
      cost: 0,
      outcome: "error",
      ts: new Date().toISOString(),
      detail: "empty brain corpus",
    });
    fail("turbo brain: no brain/ corpus found (expected brain/*.md at the repo/package root)");
    return;
  }

  const hits = searchCorpus(corpus, opts.query, opts.limit);
  logRun({
    command: "brain",
    model: "deterministic",
    duration_ms: Date.now() - start,
    cost: 0,
    outcome: "ok",
    ts: new Date().toISOString(),
    detail: `${opts.query} → ${hits.length} hits`,
  });

  if (opts.json) {
    emitJson({ ok: true, query: opts.query, hits });
    return;
  }

  if (hits.length === 0) {
    info(`No brain hits for "${opts.query}".`);
    return;
  }
  for (const h of hits) {
    info(`${h.file}  ${h.id}  (score ${h.score})`);
    info(`  ${h.heading}`);
    info(`  ${h.snippet}`);
    info("");
  }
}
