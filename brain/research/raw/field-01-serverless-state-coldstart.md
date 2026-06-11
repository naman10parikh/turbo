---
title: "The new Map() Bug Class — Serverless State & Cold Start, the Field Layer (June 2026)"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [serverless, vercel, lambda, fluid-compute, state, cold-start, race-condition, postmortem]
sources:
  - "getautonoma.com/blog/vercel-fluid-compute (fetched 2026-06-11)"
  - "vercel.com/blog/scale-to-one-how-fluid-solves-cold-starts (Vercel, 2025-09-18, fetched 2026-06-11)"
  - "vercel.com/docs/fluid-compute (fetched 2026-06-11)"
  - "medium.com/tensult/aws-lambda-function-issues-with-global-variables-eb5785d4b876 (Dilip Kola, 2018-07-31, fetched 2026-06-11)"
  - "fullstack.com/labs/resources/blog/cache-variables-with-global-context-in-aws-lambdas (fetched 2026-06-11)"
  - "github.com/vercel/vercel discussions/7961 + issue/6292 (cold-start 2-3s, fetched 2026-06-11)"
related: ["[[field-06-2026-invalidates-2025]]"]
summary: "energy's `new Map()` law is MORE right in 2026, but for a second reason it didn't state. Vercel Fluid Compute (default-on since 2025) ended one-request-per-instance isolation: module-level state is now SHARED & RACY across concurrent requests on one warm instance. The classic 'category reports got items from other categories' bug is no longer a cold-start curiosity — it's a live concurrency hazard. Two real war stories + the inversion + the audit recipe."
---

# Why this file exists
energy's TypeScript law (`~/energy/.claude/rules/typescript.md`, line 13) bans `new Map()` for
cross-request state in Vercel API routes, justified as: _"Each request may hit a cold Lambda with empty state."_
That justification was **necessary but no longer sufficient.** As of 2026 the bigger danger is the opposite of
"empty": module state is now **shared and mutated concurrently** on warm instances. This file is the field
evidence that upgrades the law's *mechanism* (the *rule* stays; the *reason* doubles).

---

## WAR STORY 1 — "category reports started getting items from other categories"
**Source:** Dilip Kola, Tensult, 2018-07-31 (canonical illustration — old, but the mechanism is unchanged and
it is the textbook reproduction of the bug class). Flagged-old per CP123 currency rule; paired below with the
2026 amplification that makes it newly dangerous.

- **Symptom (verbatim):** _"category reports started getting items from other categories."_ A user's report
  bled another user's data.
- **Root cause:** a **module-scope variable mutated inside the handler**. Lambda reuses the container between
  invocations, so the mutation persisted into the next request.
- **The reproduction (verbatim code):**
  ```javascript
  let userGreeting = "Hello <name>! Have a Nice day!!"
  exports.handler = async (event) => {
      userGreeting = userGreeting.replace("<name>", event.name);  // mutates MODULE scope
      return userGreeting;
  };
  ```
  Invoke with `name:'Dilip'` then `name:'Kola'` → second call returns **"Hello Dilip!"** — the template was
  already consumed by the first request.
- **The fix (verbatim takeaway):** _"Variables outside of the Lambda Handler should be treated as constant."_
  Move mutable state into function scope; module scope is for true constants and immutable singletons only.

**turbo lesson:** this is the *single-tenant* version of the bug (sequential reuse). Under 2026 Fluid Compute it
gets a *concurrent* sibling that's harder to spot — see the inversion below.

---

## THE 2026 INVERSION — Fluid Compute ended one-request-per-instance isolation
**Sources:** Vercel "Scale to one" blog (2025-09-18); Vercel Fluid docs; getautonoma analysis (2026); dev.to
andycasen. **Fluid Compute is the default for new Vercel projects in 2026** (it is no longer opt-in).

### What changed (Vercel's own words)
From Vercel's Scale-to-one post (2025-09-18, verbatim): _"each function instance can serve many requests at the
same time."_ Production data Vercel published: single instances _"regularly handle dozens of requests
concurrently,"_ peaking past _"250 concurrent requests per instance,"_ with most instances processing
_"11 or more"_ at once.

### The foot-gun Vercel's announcement does NOT mention
**Notable finding (verify-flag for GAPS):** Vercel's own Scale-to-one post _"contains no explicit guidance,
warnings, or discussion regarding in-memory state, module-level variables, or shared state concerns under
concurrent execution."_ The architectural shift is announced as pure upside (cold-starts solved, cost down) —
the concurrency hazard is left for third parties to document.

### What third parties documented (getautonoma, verbatim)
> "Any module-level singleton (database connection pool, in-memory cache, configuration object) is now shared
> across concurrent requests on the same instance."

> "If your function mutates a module-level variable (a common pattern for caching a database client or a config
> object), that variable is now shared across concurrent requests on the same instance. Race conditions that
> never surfaced in the original model can appear under Fluid Compute concurrency."

**The unsafe lazy-init pattern (verbatim) — note this is the pattern people reach for to *avoid* cold-start
cost:**
```javascript
let cachedClient = null;
export function GET() {
  if (!cachedClient) cachedClient = createClient(); // race condition under concurrency
}
```
Multiple concurrent requests all see `cachedClient === null`, all call `createClient()`, and you get N clients +
unpredictable which one wins the assignment.

### TASTE — the most important framing in this whole file (getautonoma, verbatim)
> "This is not a Fluid Compute bug; it is a pre-existing code smell that isolation was hiding."

And the test-suite corollary (WebSearch synthesis of the same analysis, verbatim):
> "A test suite with parallel workers that share API state through module-level singletons might expose race
> conditions, but this is not a Fluid Compute bug — it's Fluid Compute accurately reflecting how your production
> code will behave."

**This is the deep lesson for turbo:** the platform got *more honest*, not more broken. Code that "worked" only
because the old isolation model papered over a latent shared-state bug now fails loudly. The energy `new Map()`
law was protecting against exactly this class the whole time — Fluid Compute just removed the safety blanket.

---

## WAR STORY 2 — "worked locally, cached in prod" (the inverse trap)
**Source:** FullStack Labs blog + Tensult (fetched 2026-06-11). The *opposite* confusion from War Story 1, and
just as common:

- **Symptom:** global-variable caching _"did not work locally using serverless offline"_ (the local emulator
  kills the execution context immediately) _"but when deployed in AWS Lambda, the cache response worked."_
- **Why:** local dev does **not** replicate container reuse. The cache appears broken locally and "works" in
  prod — so devs ship caching logic they never actually exercised, then it bleeds state under concurrency.
- **Mechanics (verbatim):** _"After a Lambda finishes processing a request, the execution environment stays
  alive for several minutes (typically 15–40), and during this time any variables stored in the global scope
  remain available for reuse."_

**turbo lesson:** you cannot validate serverless-state behavior from `vercel dev` / `serverless offline` alone.
Either test against a real deployment under concurrency, or — better — **don't keep cross-request state in
process at all** (the law). Local "it works" tells you nothing about the warm-container concurrency path.

---

## COLD START — the *other* half of the law's original justification (still true, but moved)
- The "empty state on cold start" risk the law cites is real: Vercel users have reported **2–3s cold starts**
  (vercel/vercel discussion #7961, issue #6292). A `new Map()` populated on instance N is simply absent on the
  freshly-spun instance N+1.
- **2026 update:** Fluid's _"scale to one"_ (Pro/Enterprise prod keeps ≥1 warm instance) **reduces cold-start
  frequency** but does **not** make in-process state durable — a warm instance can still be recycled, scaled
  out, or load-balanced away. **Net: cold starts are rarer but state is now *also* unsafe when warm.** Both
  failure modes argue for the same fix: externalize state (Upstash/Supabase) or pass IDs from the client.

---

## THE AUDIT RECIPE (what to grep before shipping any turbo Vercel route)
Distilled from the getautonoma mitigation guidance + the energy law:
1. **Grep for module-scope mutables conditionally assigned in handlers** — `let x = null; … if (!x) x = …`
   inside or above an exported handler. These are the race sources.
2. **Module-level arrays/objects that accumulate** across requests (`const seen = []; seen.push(...)` at module
   scope) — guaranteed cross-request bleed under Fluid.
3. **Any `new Map()` / `new Set()` / plain object used as a cache or session store at module scope** in
   `app/api/**` → **banned by the energy law.** Replace with Upstash (Redis) / Supabase, or pass the ID from the
   client.
4. **DB clients:** use a **connection pool that manages its own internal concurrency** (the pool is safe to hold
   at module scope), not a raw lazily-assigned client reference. The pool object is concurrency-safe; the
   `cachedClient = null` lazy-init is not.
5. **Never validate state behavior from local dev** — local emulators don't reuse containers; test on a real
   deployment or design the state out entirely.

## ONE-LINE TASTE TO CARRY
> Isolation was hiding your bug. 2026 took the blanket away. If state must outlive a request, it lives in
> Upstash/Supabase — never in a process the platform is free to share, recycle, or fan out.
