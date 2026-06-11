/**
 * `turbo explain <P-id|S-id|O-id>` — print the pitfall / scenario / opinion by id, with the full
 * section body (which carries the detection + fix). Resolves the id against the brain corpus.
 */
import { findById, loadCorpus } from "../../memory/bm25.js";
import { brainDir } from "../paths.js";
import { emitJson, fail, info } from "../io.js";
import { logRun } from "../../obs/run-logger.js";

export interface ExplainOptions {
  id: string;
  json: boolean;
}

export function runExplain(opts: ExplainOptions): void {
  const start = Date.now();
  const corpus = loadCorpus(brainDir());
  const chunk = findById(corpus, opts.id);

  if (!chunk) {
    logRun({
      command: "explain",
      model: "deterministic",
      duration_ms: Date.now() - start,
      cost: 0,
      outcome: "error",
      ts: new Date().toISOString(),
      detail: `unknown id ${opts.id}`,
    });
    if (opts.json) emitJson({ ok: false, error: `unknown id: ${opts.id}` });
    fail(`turbo explain: no brain entry with id "${opts.id}" (expected a P-/S-/O- code)`);
    return;
  }

  logRun({
    command: "explain",
    model: "deterministic",
    duration_ms: Date.now() - start,
    cost: 0,
    outcome: "ok",
    ts: new Date().toISOString(),
    detail: `${opts.id} → ${chunk.file}`,
  });

  if (opts.json) {
    emitJson({ ok: true, id: chunk.id, file: chunk.file, heading: chunk.heading, body: chunk.text });
    return;
  }
  info(`# ${chunk.id}  (${chunk.file})`);
  info("");
  info(chunk.text);
}
