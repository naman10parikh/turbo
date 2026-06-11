/**
 * bm25 — a real ranked BM25 search over the six `brain/` artifacts (the Memory component's
 * queryable layer, HARNESS-OVERRIDES §2). This is NOT grep: it tokenizes the corpus into ID-tagged
 * chunks (each `## P-NN` / `## S-NN` / `## O-NN` section + each file's preamble), builds term
 * frequencies + inverse-document-frequency, and ranks chunks by the Okapi BM25 score for a query.
 *
 * Zero-dep on purpose (the energy Simplicity-First law): the corpus is small (six markdown files),
 * so an in-process index built per invocation is fast enough and needs no external search engine.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** One searchable unit: an ID-tagged section of a brain file. */
export interface BrainChunk {
  /** The artifact filename, e.g. `KNOWN-PITFALLS.md`. */
  readonly file: string;
  /** The P-/S-/O- id if the chunk is an ID section, else a heading slug or "preamble". */
  readonly id: string;
  /** The section heading text (for display). */
  readonly heading: string;
  /** The raw section text (heading + body). */
  readonly text: string;
}

/** A ranked search hit. */
export interface BrainHit {
  readonly file: string;
  readonly id: string;
  readonly heading: string;
  readonly score: number;
  /** A short snippet for display (first ~200 chars of the body). */
  readonly snippet: string;
}

/** The six brain artifacts the Memory layer indexes (NOT code history). */
export const BRAIN_FILES = [
  "TOOL-MATRIX.md",
  "BATTLE-TESTED-SCENARIOS.md",
  "KNOWN-PITFALLS.md",
  "OPINIONS.md",
  "EXPERTISE-MAP.md",
  "GAPS-AND-DISPUTES.md",
] as const;

/** Pull an explicit `P-04` / `S-02` / `O-07` id out of a `## ` heading, if present. */
function idFromHeading(heading: string): string | undefined {
  const m = /\b([PSO]-\d{1,2})\b/.exec(heading);
  return m ? m[1] : undefined;
}

/** Slugify a heading into a stable id when there is no P-/S-/O- code. */
function slug(heading: string): string {
  return (
    heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "section"
  );
}

/** Split one brain file's text into `## `-delimited, ID-tagged chunks. */
export function chunkFile(file: string, text: string): BrainChunk[] {
  const lines = text.split("\n");
  const chunks: BrainChunk[] = [];
  let heading = "preamble";
  let buf: string[] = [];

  const flush = (): void => {
    const body = buf.join("\n").trim();
    if (body.length === 0 && heading === "preamble") return;
    const id = idFromHeading(heading) ?? slug(heading);
    chunks.push({ file, id, heading, text: `${heading}\n${body}`.trim() });
  };

  for (const line of lines) {
    // A new `## ` heading starts a new chunk (skip deeper `### `/`#### ` so a P-section stays whole).
    if (/^## (?!#)/.test(line)) {
      flush();
      heading = line.replace(/^#+\s*/, "").trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  flush();
  return chunks;
}

/** Build the full chunk corpus from a brain directory. Missing files are skipped (degrade, not crash). */
export function loadCorpus(brainDir: string): BrainChunk[] {
  const corpus: BrainChunk[] = [];
  for (const file of BRAIN_FILES) {
    try {
      const text = readFileSync(join(brainDir, file), "utf8");
      corpus.push(...chunkFile(file, text));
    } catch {
      // A missing brain file degrades the index; it must never crash the search (the law).
    }
  }
  return corpus;
}

/** Lowercase alnum tokenizer; keeps `p-04`/`v1`/`4.12.25` style tokens intact enough to match. */
export function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+(?:[._-][a-z0-9]+)*/g) ?? []).filter((t) => t.length > 1);
}

const K1 = 1.5;
const B = 0.75;

/**
 * Rank brain chunks for a query with Okapi BM25.
 * An exact P-/S-/O- id in the query gets a deterministic boost so `turbo explain P-04` and a query
 * that names an id always surface that section.
 */
export function searchCorpus(corpus: readonly BrainChunk[], query: string, limit = 5): BrainHit[] {
  const docs = corpus.map((c) => tokenize(c.text));
  const N = docs.length;
  if (N === 0) return [];

  const avgLen = docs.reduce((sum, d) => sum + d.length, 0) / N;

  // Document frequency per term.
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const idf = (term: string): number => {
    const n = df.get(term) ?? 0;
    // BM25 idf with the +1 smoothing that keeps it non-negative.
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  };

  const qTerms = tokenize(query);
  const queryIds = new Set((query.toUpperCase().match(/\b[PSO]-\d{1,2}\b/g) ?? []));

  const scored = corpus.map((chunk, i) => {
    const doc = docs[i] ?? [];
    const len = doc.length;
    const tf = new Map<string, number>();
    for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of qTerms) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const denom = f + K1 * (1 - B + (B * len) / avgLen);
      score += idf(term) * ((f * (K1 + 1)) / denom);
    }
    // Exact-id boost: a query naming P-04 forces the P-04 chunk to the top.
    if (queryIds.has(chunk.id.toUpperCase())) score += 1000;
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk, score }) => ({
      file: chunk.file,
      id: chunk.id,
      heading: chunk.heading,
      score: Number(score.toFixed(4)),
      snippet: chunk.text.replace(/\s+/g, " ").slice(0, 200),
    }));
}

/** Find a single chunk by exact P-/S-/O- id (for `turbo explain`). */
export function findById(corpus: readonly BrainChunk[], id: string): BrainChunk | undefined {
  const want = id.toUpperCase();
  return corpus.find((c) => c.id.toUpperCase() === want);
}
