---
name: audit-serverless-state
description: Hunt the cross-request state bug — module-scope `new Map()` / mutable state that bleeds one user's data into another under Vercel Fluid Compute. Use when asked to "audit for the Map bug", "check for cross-request state", "find the data-bleed", "why are users seeing each other's data", or before shipping any serverless route. Encodes turbo's S-01 scenario + O-01 opinion + P-02 pitfall — the 🔴 data-bleed class.
---

# audit-serverless-state

> Encodes scenario **S-01** (cross-user data bleed under Fluid Compute), opinion **O-01** (always externalize cross-request state; never hold it in process — now for TWO reasons), and pitfall **P-02** (`new Map()` / module-scope state on Vercel is now RACY, not just empty). This is the highest-severity bug turbo guards: 🔴 cross-user data bleed.

## Trigger

Invoke when the user (or a coding agent) asks to:
- "audit for the Map / Fluid bug" / "check for cross-request state" / "find the data bleed"
- "why are users seeing each other's data" / "category reports show items from other categories"
- a pre-ship review of any Vercel/serverless route (`app/api/**`)

Also invoke proactively before shipping any service that has module-scope state.

## Steps

1. **Run the detector (don't eyeball it):**
   ```bash
   turbo audit <service-dir> --json
   ```
   The P-02 detector greps `app/api/**` for `new Map()` / `new Set()` / object-as-cache at module scope and lazy-init `if (!cachedClient) cachedClient = createClient()` above a handler. It reports `[{pitfall:"P-02", file, line, severity}]`.
2. **Understand why local testing can't catch it.** The bug is **invisible in `vercel dev`** — emulators don't reuse containers, so the race never fires locally. Never accept "it works locally" as proof. The condition: Vercel **Fluid Compute is default-on (2026)**; one warm instance serves dozens (peaks past 250) of concurrent requests that **share and race** module state.
3. **For each finding, apply the fix (route, don't rebuild):**
   - Treat everything outside the handler as a **constant**. Move mutable state into **function scope**.
   - For genuine cross-request cache/session/counter, **externalize** to Upstash / Supabase / KV / Durable Objects, OR pass the ID from the client (the energy `new Map()` law).
   - **Do NOT build a cache store here** — that is echo's seam (rate-limit / cache / KV). turbo's job is to *detect* the bug and *route the fix to externalize*, never to implement the cache. `rhinobase/hono-rate-limiter` is "do NOT wire."
4. **Respect the escape hatch (don't over-flag):** a DB **connection pool** is safe at module scope (it manages its own concurrency). Truly-immutable singletons / constants are fine. The ban is on *mutable cross-request* state — a raw lazily-assigned client ref is NOT safe; a pool IS.
5. **Prove the fix with a concurrency test:** fire parallel requests with distinct inputs; assert each caller gets **its own** data back. Then re-run `turbo audit` and confirm **zero P-02**.

## Output

A findings report:
- the P-02 findings table (`file:line`, what's at module scope)
- per finding: the fix (move-to-function-scope / externalize / pass-ID-from-client) — never "build a cache"
- a note for any false-positive (a connection pool / immutable constant) explaining why it's exempt
- the concurrency-test result (each caller got its own data)
- the closing line: *"This is not a Fluid Compute bug; it is a pre-existing code smell that isolation was hiding."*
- a pointer: cache/rate-limit/KV is **echo's** territory, not turbo's.
