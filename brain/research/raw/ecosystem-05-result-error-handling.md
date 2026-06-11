---
title: "Result<T,E> Error Handling — neverthrow vs Effect vs try-catch (June 2026)"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [result, error-handling, neverthrow, effect, typescript]
sources:
  - "https://github.com/supermacro/neverthrow (fetched 2026-06-11; v8.2.0)"
  - "https://effect.website/docs/additional-resources/effect-vs-neverthrow/"
  - "WebSearch: neverthrow vs Effect vs oxide.ts 2026 (pkgpulse, devalade, solberg.is)"
summary: "energy law mandates Result<T,E> + no try-catch-swallow. neverthrow@8.2.0 is the pragmatic default; Effect for system-wide FP; try-catch only at the boundary to wrap throwing 3rd-party code via fromThrowable/fromPromise. safeTry kills andThen-chain boilerplate; eslint-plugin-neverthrow enforces consumption."
---

# The energy law (verbatim, the thing turbo must obey)
From `~/energy/.claude/rules/typescript.md`:
> "Error handling: use Result<T, E> pattern, never try-catch-swallow. Every catch block must
> `console.warn("[module] context:", err.message)` or comment `// Intentionally silent: [reason]`."
> "Async: always handle rejections, never fire-and-forget."

So turbo cannot just `throw`/`try{}catch{}` and move on. The default is an explicit, typed `Result<T,E>`.

# The 2026 decision (when to use which)
(Source: devalade.me, solberg.is, pkgpulse 2026)
- **try-catch** — ONLY at the **boundary**, to wrap throwing third-party code and **convert** it into a Result.
  Also legitimate for *truly exceptional* failures (OOM, fatal crash) you intend to let crash the process.
- **neverthrow (`Result<T,E>`)** — the **default** for expected domain errors (`NotFound`, `ValidationError`,
  `DbError`). Explicit, type-safe, **no paradigm shift**, value at the level of an individual function.
  Adopt incrementally: start with your most error-prone DB queries, give them `Result<Data, DbError>`, expand.
- **Effect (`effect@3.21.3`)** — the **most powerful + most type-safe** (typed errors in the type signature,
  dependency injection, structured concurrency, retries, interruption), but it's a **whole paradigm** — benefits
  most from **system-wide** adoption and is overkill for simple services. Use only if turbo builds something that
  genuinely needs Effect's runtime (complex concurrency/resource-safety). Otherwise neverthrow.

**Performance:** Result types add **no meaningful CPU/memory overhead** for any reasonable request volume —
`ok(value)` is a tiny object alloc; `ResultAsync` wraps a Promise with no extra layers. So "Result is slow" is
a non-argument.

---

# neverthrow@8.2.0 — the API turbo will actually use (source: GitHub README, fetched 2026-06-11)

**Constructors:** `ok(value)` / `err(error)` / `okAsync` / `errAsync`.
**Checks:** `.isOk()` / `.isErr()`.
**Transform:** `.map(fn)` (Ok), `.mapErr(fn)` (Err), `.andThen(fn)` (chain + flatten), `.asyncAndThen`,
`.orElse(fn)` (recover), `.match(okCb, errCb)`, `.unwrapOr(default)`.
**Side effects:** `.andTee(fn)` (pass-through Ok), `.orTee(fn)` (pass-through Err), `.andThrough(fn)`
(tee but propagates errors).
**Combinators:** `Result.combine([...])` (short-circuits on first Err), `Result.combineWithAllErrors([...])`
(collects ALL errors into an array — use for validating many fields at once).

## THE critical pattern — converting throwing code (do this at every boundary)
The README is explicit: _"when interfacing with third party libraries it's imperative that you wrap third-party
code in try/catch"_ — and neverthrow gives you the converters so you write the try/catch **once**:
```ts
// sync throwers (JSON.parse, etc.):
const toParseError = (): ParseError => ({ message: "Parse Error" })
const safeJsonParse = Result.fromThrowable(JSON.parse, toParseError)   // → (s) => Result<unknown, ParseError>

// async / promise throwers:
const safeFetch = ResultAsync.fromPromise(fetch(url), (e) => toFetchError(e))
```
**Always pass the second `errorFn`** — you cannot know what a library throws, so map it to a **known error type**.
This is the neverthrow-idiomatic way to satisfy the energy "no try-catch-swallow" law: the catch lives inside
`fromThrowable`/`fromPromise` and produces a typed Err instead of swallowing.

### GOTCHA — "promise-returning" ≠ "async"
A function can **return a Promise yet throw synchronously** (validation before the await). `fromPromise` only
catches rejections; for non-`async` promise-returners use `fromThrowable` to also catch the synchronous throw.
Getting this wrong = an uncaught sync throw escaping your Result boundary. (Documented gotcha.)

## `safeTry` — kills the andThen-chain pyramid (use this for readable flows)
Instead of nesting `.andThen().andThen()`, use the generator form: `yield*` an Err to early-return, or unwrap
the Ok and continue:
```ts
return safeTry<Sum, MyErr>(function* () {
  return ok( (yield* mayFail1().mapErr(toMyErr)) + (yield* mayFail2().mapErr(toMyErr)) )
})
// async: safeTry(async function* () { ... yield* resultAsync ... })
```
Reads like normal sequential code, stays fully typed, short-circuits on first Err. **turbo rule: prefer
`safeTry` for multi-step flows; reserve `.andThen` chains for short 1–2 step transforms.**

## `ResultAsync` is **thenable**
It behaves like a native `Promise<Result>` — you can `await` it directly, but you ALSO get `.map/.andThen/.match`
without awaiting first. So `await someResultAsync` gives you a `Result<T,E>` to `.match` on. This is why turbo's
async handlers can return `ResultAsync` and the route layer just `await`s + `.match`es into an HTTP response.

## ENFORCEMENT — `eslint-plugin-neverthrow`
Install it. It enforces that **every Result is consumed** (via `.match()`, `.unwrapOr()`, or the explicit
`._unsafeUnwrap()`), analogous to Rust's `#[must_use]`. Without it, an unhandled `Result` (forgotten `.match`)
silently drops the error — which is exactly the "fire-and-forget" the energy law bans. **turbo rule: this plugin
is non-optional in the lint config.**

---

# How this composes with Hono + Zod (the turbo request lifecycle)
1. **Zod** parses the request at the boundary (`zValidator` / Standard Schema middleware) → on failure, Hono
   returns 400 with the Zod error (`z.prettifyError`).
2. The handler calls domain functions that return **`ResultAsync<T, DomainError>`** (DB, external APIs wrapped
   via `fromPromise`).
3. The handler `await`s and `.match`es: `Ok → c.json(data, 200)`, `Err → c.json({error}, statusForError)`.
4. A central `mapErrorToResponse(e: DomainError)` turns each typed domain error into an HTTP status —
   discriminated union over the error type, so adding an error variant is a compile error until you map it.
This gives **exhaustive, typed, non-throwing** error handling end to end, satisfying both the energy Result law
and the Zod-at-boundary law in one pipeline.

> Note: `oxide.ts` exists as a lighter Result lib, but neverthrow@8.2.0 is the most adopted + best-documented +
> has the eslint plugin → it's turbo's default. Effect remains the escape hatch for genuinely Effect-shaped work.
