// turbo cockpit SPA — vanilla JS, zero deps, no build (CP123 Cluster G / G28).
// Read-mostly: every call hits a GET endpoint that reads brain/ markdown, logs/runs.jsonl, or the
// cached eval result, or shells out to the READ-ONLY `turbo brain`/`turbo explain` (Q5). Nothing
// here triggers a build/scaffold/audit — those are the CLI/MCP (agent) surfaces.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const BRAIN_FILES = [
  ["EXPERTISE-MAP.md", "the map of mastery, by job"],
  ["KNOWN-PITFALLS.md", "P-01…P-16 — detection + fix"],
  ["BATTLE-TESTED-SCENARIOS.md", "S-01…S-13 — golden tasks"],
  ["OPINIONS.md", "O-01…O-14 — the taste layer"],
  ["GAPS-AND-DISPUTES.md", "where sources disagree"],
  ["TOOL-MATRIX.md", "defaults vs alts, secrets"],
];

async function api(path) {
  try {
    const r = await fetch(path);
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e && e.message) };
  }
}

// ---------- minimal, safe markdown → HTML (no deps) ----------
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Linkify P-/S-/O-IDs so the chairman can click any reference to read its detail in Ask.
function linkifyIds(html) {
  return html.replace(/\b([PSO]-\d{1,3})\b/g, '<a data-id="$1">$1</a>');
}
function mdToHtml(md) {
  const lines = md.split("\n");
  let out = [];
  let inCode = false;
  let inList = false;
  for (let raw of lines) {
    if (raw.startsWith("```")) {
      if (inCode) { out.push("</code></pre>"); inCode = false; }
      else { if (inList) { out.push("</ul>"); inList = false; } out.push("<pre><code>"); inCode = true; }
      continue;
    }
    if (inCode) { out.push(esc(raw)); continue; }
    // strip YAML frontmatter fences gracefully
    if (raw.trim() === "---" && out.length < 2) { continue; }

    let line = esc(raw);
    // inline: `code`, **bold**, *em*
    line = line.replace(/`([^`]+)`/g, "<code>$1</code>");
    line = line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    line = line.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

    if (/^#{3}\s/.test(raw)) { if (inList) { out.push("</ul>"); inList = false; } out.push("<h3>" + line.replace(/^#{3}\s/, "") + "</h3>"); continue; }
    if (/^#{2}\s/.test(raw)) { if (inList) { out.push("</ul>"); inList = false; } out.push("<h2>" + line.replace(/^#{2}\s/, "") + "</h2>"); continue; }
    if (/^#\s/.test(raw)) { if (inList) { out.push("</ul>"); inList = false; } out.push("<h1>" + line.replace(/^#\s/, "") + "</h1>"); continue; }
    if (/^[-*]\s/.test(raw)) { if (!inList) { out.push("<ul>"); inList = true; } out.push("<li>" + line.replace(/^[-*]\s/, "") + "</li>"); continue; }
    if (raw.trim() === "") { if (inList) { out.push("</ul>"); inList = false; } out.push(""); continue; }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push("<p>" + line + "</p>");
  }
  if (inList) out.push("</ul>");
  if (inCode) out.push("</code></pre>");
  return linkifyIds(out.join("\n"));
}

// ---------- view: brain browser ----------
let activeBrainFile = null;
function renderBrainFileList() {
  const host = $("#brain-files");
  host.innerHTML = "";
  for (const [file, tag] of BRAIN_FILES) {
    const b = document.createElement("button");
    b.innerHTML = `${file.replace(".md", "")}<span class="ftag">${tag}</span>`;
    b.dataset.file = file;
    if (file === activeBrainFile) b.classList.add("active");
    b.addEventListener("click", () => loadBrainDoc(file));
    host.appendChild(b);
  }
}
async function loadBrainDoc(file) {
  activeBrainFile = file;
  renderBrainFileList();
  const body = $("#brain-body");
  body.innerHTML = '<div class="empty">loading…</div>';
  const res = await api("/api/brain-doc?file=" + encodeURIComponent(file));
  if (!res.ok) { body.innerHTML = `<div class="empty">could not load ${esc(file)}</div>`; return; }
  body.innerHTML = mdToHtml(res.markdown);
}
async function searchBrain(q) {
  const body = $("#brain-body");
  if (!q.trim()) { if (activeBrainFile) loadBrainDoc(activeBrainFile); return; }
  body.innerHTML = '<div class="empty">searching…</div>';
  activeBrainFile = null;
  renderBrainFileList();
  const res = await api("/api/brain?q=" + encodeURIComponent(q));
  if (!res.ok || !res.hits || !res.hits.length) {
    body.innerHTML = `<div class="empty">no hits for “${esc(q)}”.</div>`;
    return;
  }
  body.innerHTML = "";
  for (const h of res.hits) {
    const card = document.createElement("div");
    card.className = "hit";
    card.innerHTML =
      `<div class="hit-head"><span class="hit-id">${esc(h.id || "")}</span>` +
      `<span class="hit-file">${esc(h.file)}</span>` +
      `<span class="hit-score">score ${h.score != null ? h.score.toFixed(2) : "—"}</span></div>` +
      `<div class="hit-snippet">${esc(h.snippet || h.heading || "")}</div>`;
    card.addEventListener("click", () => { if (h.id) askById(h.id); });
    body.appendChild(card);
  }
}

// ---------- view: ask the employee ----------
async function askQuery(q) {
  const host = $("#ask-answer");
  host.innerHTML = '<div class="answer-card"><div class="a-body muted">asking turbo…</div></div>';
  const res = await api("/api/brain?q=" + encodeURIComponent(q));
  host.innerHTML = "";
  // Surface the echo boundary when the question is about rate-limit/cache.
  if (/rate.?limit|caching|\bcache\b/i.test(q)) {
    const note = document.createElement("div");
    note.className = "boundary-note";
    note.innerHTML = "<strong>That's echo's, not mine.</strong> turbo owns API/runtime only — it emits " +
      "<code>cache-control</code>/<code>ETag</code> <em>header semantics</em> and audits the <code>new Map()</code> " +
      "cache bug, but the rate-limit / cache <em>store</em> is echo's seam (Wave&nbsp;2).";
    host.appendChild(note);
  }
  if (!res.ok || !res.hits || !res.hits.length) {
    const d = document.createElement("div");
    d.className = "answer-card";
    d.innerHTML = `<div class="a-body muted">No brain hit for “${esc(q)}”. Try an exact ID or a scenario phrase.</div>`;
    host.appendChild(d);
    return;
  }
  // Show the top hit in full (explain), then list the runners-up.
  const top = res.hits[0];
  if (top.id) await renderExplainInto(host, top.id);
  if (res.hits.length > 1) {
    const more = document.createElement("div");
    more.className = "muted";
    more.style.fontSize = "0.8rem";
    more.innerHTML = "also relevant: " + res.hits.slice(1, 4)
      .map((h) => `<a class="pill" data-id="${esc(h.id || "")}">${esc(h.id || h.file)}</a>`).join(" ");
    host.appendChild(more);
  }
}
async function renderExplainInto(host, id) {
  const res = await api("/api/explain?id=" + encodeURIComponent(id));
  const card = document.createElement("div");
  card.className = "answer-card";
  if (!res.ok) {
    card.innerHTML = `<div class="a-id">${esc(id)}</div><div class="a-body muted">${esc(res.error || "no detail")}</div>`;
  } else {
    let body = esc(res.body || "");
    body = body.replace(/`([^`]+)`/g, "<code>$1</code>");
    card.innerHTML = `<div class="a-id">${esc(res.id)} · ${esc(res.file)}</div><div class="a-body">${body}</div>`;
  }
  host.appendChild(card);
}
async function askById(id) {
  switchView("ask");
  $("#ask-q").value = id;
  const host = $("#ask-answer");
  host.innerHTML = "";
  await renderExplainInto(host, id);
}

// ---------- view: run log ----------
function fmtWhen(ts) {
  try { const d = new Date(ts); return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return ts || "—"; }
}
async function loadRuns() {
  const res = await api("/api/runs?limit=100");
  const body = $("#runs-body");
  $("#runs-count").textContent = res.total ? `${res.total} runs logged · showing newest ${Math.min(res.total, 100)}` : "no runs yet";
  body.innerHTML = "";
  for (const r of (res.runs || [])) {
    const tr = document.createElement("tr");
    const ok = r.outcome === "ok";
    tr.innerHTML =
      `<td class="muted">${esc(fmtWhen(r.ts))}</td>` +
      `<td class="c-cmd">${esc(r.command || "—")}</td>` +
      `<td class="muted">${esc(r.model || "—")}</td>` +
      `<td class="c-ms">${r.duration_ms != null ? r.duration_ms : "—"}</td>` +
      `<td class="${ok ? "badge-ok" : "badge-err"}">${esc(r.outcome || "—")}</td>` +
      `<td class="c-detail">${esc(r.detail || "")}</td>`;
    body.appendChild(tr);
  }
}

// ---------- view: eval scores ----------
async function loadEvals() {
  const res = await api("/api/eval");
  const meta = $("#evals-meta");
  const summary = $("#evals-summary");
  const grid = $("#evals-grid");
  if (!res.ok || !res.result) {
    meta.textContent = "";
    summary.innerHTML = "";
    grid.innerHTML = `<div class="empty">${esc(res.note || "eval cache not built yet — it warms in the background on serve.")}</div>`;
    return;
  }
  const r = res.result;
  meta.innerHTML = `the eval pyramid (green/red, not Likert) · as of <strong>${esc(new Date(res.asOf).toLocaleString())}</strong>`;
  const allGreen = r.failed === 0;
  summary.innerHTML =
    `<div class="sum-card ${allGreen ? "green" : ""}"><div class="sv">${r.passed}/${r.total}</div><div class="sk">tasks passing</div></div>` +
    `<div class="sum-card amber"><div class="sv">${r.ciBlockingPassed}/${r.ciBlockingTotal}</div><div class="sk">CI-blocking green</div></div>` +
    `<div class="sum-card ${allGreen ? "green" : ""}"><div class="sv">${allGreen ? "PASS" : "RED"}</div><div class="sk">acceptance gate</div></div>`;
  grid.innerHTML = "";
  for (const t of (r.tasks || [])) {
    const card = document.createElement("div");
    card.className = "eval-card" + (t.passed ? "" : " fail");
    card.innerHTML =
      `<div class="eval-head"><span class="eval-g">${esc(t.g)}</span><span class="eval-sid">${esc(t.id)}</span>` +
      `<span class="eval-lvl">L${t.level}</span></div>` +
      `<div><span class="eval-status ${t.passed ? "pass" : "fail"}">${t.passed ? "✓ pass" : "✗ fail"}</span>` +
      (t.ciBlocking ? ` &nbsp;<span class="eval-blocking">CI-blocking · pass^${t.trials}</span>` : "") + `</div>` +
      `<div class="eval-ev">${esc(t.evidence || "")}</div>`;
    grid.appendChild(card);
  }
}

// ---------- top-of-page stats ----------
async function loadStats() {
  const [ev, runs] = await Promise.all([api("/api/eval"), api("/api/runs?limit=1")]);
  if (ev.ok && ev.result) {
    $("#stat-evals").textContent = `${ev.result.passed}/${ev.result.total}`;
    $("#stat-blocking").textContent = `${ev.result.ciBlockingPassed}/${ev.result.ciBlockingTotal}`;
  }
  if (runs.ok) $("#stat-runs").textContent = runs.total;
}

// ---------- view switching ----------
const LOADERS = { brain: () => { if (!activeBrainFile) loadBrainDoc("KNOWN-PITFALLS.md"); }, ask: () => {}, runs: loadRuns, evals: loadEvals };
function switchView(name) {
  $$(".rail button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  if (LOADERS[name]) LOADERS[name]();
}

// ---------- wire up ----------
function init() {
  renderBrainFileList();
  $$(".rail button").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));

  let brainTimer;
  $("#brain-q").addEventListener("input", (e) => {
    clearTimeout(brainTimer);
    const v = e.target.value;
    brainTimer = setTimeout(() => searchBrain(v), 200);
  });

  $("#ask-go").addEventListener("click", () => { const q = $("#ask-q").value.trim(); if (q) askQuery(q); });
  $("#ask-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { const q = e.target.value.trim(); if (q) askQuery(q); } });
  $$(".chip").forEach((c) => c.addEventListener("click", () => {
    if (c.dataset.id) askById(c.dataset.id);
    else { $("#ask-q").value = c.dataset.q; askQuery(c.dataset.q); }
  }));

  // Delegated: any clickable P-/S-/O-id anywhere (brain body, hit cards, runner-ups) → Ask.
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-id]");
    if (a && a.dataset.id) { e.preventDefault(); askById(a.dataset.id); }
  });

  loadBrainDoc("KNOWN-PITFALLS.md");
  loadStats();
}
init();
