---
title: "Zod v4 + Standard Schema — Validation at Every Boundary (June 2026)"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [zod, validation, standard-schema, valibot, arktype, boundary]
sources:
  - "https://zod.dev/v4 (fetched 2026-06-11)"
  - "https://zod.dev/v4/changelog"
  - "https://github.com/standard-schema/standard-schema"
  - "WebSearch: Standard Schema adopters / Zod 4 migration (2026-06-11)"
  - "pockit.tools, dev.to/pockit_tools, souvenirlist.com (2026 migration guides)"
summary: "Zod 4.4.3 is the law's default validator (energy: 'Zod at every API boundary'). v4 is 14x faster + 2.3x smaller; the .default()-on-PATCH data-loss gotcha and z.coerce input=unknown are the real migration traps. Standard Schema makes the validator swappable."
---

# Zod at Every Boundary — the energy law, made concrete

energy `typescript.md` mandates: **"Use Zod for runtime validation at API boundaries."** For turbo this is THE
validation contract. Current: **zod@4.4.3** (2026-05-04). v4.0 was a ground-up rewrite; v4.4 is current stable;
v4.5 in canary. This file documents v4 specifics, the migration traps, and the Standard Schema escape hatch.

## What a "boundary" is (turbo's definition)
Every place untrusted data crosses into typed code: HTTP request body/query/params/headers, env vars, DB rows
read back, third-party API responses, queue messages, file contents. The rule: **parse, don't validate** — at
the boundary, run `schema.parse(input)` and from then on the value is typed; never re-check downstream.

---

# Zod v4 vs v3 — the hard numbers (source: zod.dev/v4)

| Metric | Zod 3 | Zod 4 | Delta |
|---|---|---|---|
| String parsing | 363 µs/iter | 24,674 ns/iter | **14.71x faster** |
| Array parsing | 147 µs/iter | 19,817 ns/iter | **7.43x faster** |
| Object parsing | 805 µs/iter | 124 µs/iter | **6.5x faster** |
| tsc time (chained `.extend()/.omit()`) | 4000ms | 400ms | **10x fewer instantiations** |
| Core bundle (gzip) | 12.47kb | **5.36kb** | 2.3x smaller |
| `zod/mini` (gzip) | — | **1.88kb** | 6.6x smaller than v3 |

**Why this matters for turbo:** Zod 3's `z.infer` was a notorious source of slow tsserver in large APIs (same
class of pain as Hono RPC). Zod 4's reduced instantiation count + `zod/mini` for edge bundles directly attack
both the IDE-perf and edge-cold-start constraints turbo cares about.

## Architecture shift
- **`zod/v4/core`** — shared foundation lib authors build on (this is what lets Hono/tRPC validators interop).
- **`zod` (full)** — the method-chaining API everyone knows (`z.string().min(3)`).
- **`zod/mini`** — functional, tree-shakeable variant (`pipe(string(), minLength(3))`) for bundle-critical edge.
  Use `zod/mini` ONLY where bundle size is measured-critical (Workers); the ergonomics are worse.

---

# THE PRODUCTION TRAPS (the part listicles skip)

### TRAP 1 — `.default()` data loss on PATCH (the dangerous one)
In Zod 4, `.default()` **short-circuits**: when input is `undefined`, it returns the default *unconditionally*,
**even on a `.partial()` schema**. So if you reuse your create-schema (which has `.default()`s) to validate a
**PATCH** body, omitted fields get silently overwritten with defaults → **DATA LOSS**.
**Fix (turbo rule):** maintain a **dedicated PATCH schema with NO `.default()`s** (or `.partial()` a base that
has no defaults). Never reuse a defaulted create-schema for partial updates.
(Source: pockit.tools / dev.to Zod-4 migration guides, 2026.)

### TRAP 2 — `z.coerce.*` input type is now `unknown`
v4 made `z.coerce.number()` etc. accept `unknown` as input (honest: coercion takes anything). This **surfaces
new TS errors** in code that relied on v3's narrowed input type. Expect compile breaks on upgrade; they're
correct — tighten the upstream type or accept `unknown`.

### TRAP 3 — string-format validators moved to top-level + stricter
`z.string().email()/.url()/.uuid()` are deprecated → use `z.email()`, `z.url()`, `z.uuid()`. **`z.uuid()` is now
RFC-9562/4122 strict** (validates variant bits) and is **NOT compatible with v3's `z.string().uuid()`** — a
previously-passing UUID may now fail. For permissive matching use the new `z.guid()`. This breaks data that
isn't a canonical UUID.

### TRAP 4 — error-customization API fully redesigned
All of `message` / `invalid_type_error` / `required_error` / `errorMap` collapse into **one `error` param**
(string or function). Old code using the separate params is deprecated. New `z.prettifyError()` formats for
display. If turbo surfaces validation errors to clients, standardize on one `error` shape + `prettifyError`.

### TRAP 5 — `.merge()` removed → use `.extend()` or shape spread
`.merge()` is gone in v4; use `.extend()` or `{ ...A.shape, ...B.shape }`.

### Migration tooling
- Official changelog: https://zod.dev/v4/changelog
- Community codemod `zod-v3-to-v4` (and Hypermod's "Zod v4 Codemod") automate the mechanical renames.
- Ecosystem readiness (as of Mar 2026): tRPC v11+, @tanstack/react-form, Conform, react-hook-form v8 +
  @hookform/resolvers v4+, and **`zod-validation-error` must be ≥ v5.0.0**.

---

# Standard Schema — the validator becomes swappable (huge for 2026)

**Standard Schema** (spec version 1) is a tiny interop spec: any schema exposes a `~standard` readonly property
carrying `{ version, vendor, validate(), types }`. A framework that "speaks Standard Schema" can validate with
**any** compliant library without per-library adapters.

- **Implemented by:** Zod, Valibot, ArkType (co-authored by all three's creators).
- **Consumed by:** **Hono** (`@hono/standard-validator`), **tRPC**, **TanStack Form**, **TanStack Router**, and
  a growing list. (Source: WebSearch 2026-06-11; standardschema.dev; hono.dev/docs/guides/validation.)
- **Why it matters for turbo:** you can default to Zod but keep the framework binding generic. If a service is
  bundle-critical you can swap Zod→Valibot **without touching the Hono route code** (package swap, same
  `~standard` interface). This de-risks the validator choice. **turbo rule:** bind validators through
  Standard-Schema-aware middleware (`@hono/standard-validator`) rather than the Zod-specific
  `@hono/zod-validator` *when* swappability is wanted; use `@hono/zod-validator` when you want Zod-specific
  ergonomics (it's still fine and slightly more featureful for Zod).

## Zod vs Valibot vs ArkType (quick boundary call — full matrix in ecosystem-12)
- **Zod 4** — default. Best ecosystem, best docs, `z.toJSONSchema()` for OpenAPI, now fast + small enough.
- **Valibot 1.4** — pick when **bundle size is the binding constraint** (modular, ~sub-2kb tree-shaken). Worse
  DX than Zod's chaining for complex schemas.
- **ArkType 2.2** — pick when you want **TS-syntax-as-schema** (`type({ name: "string>2" })`) and max runtime
  perf; smaller ecosystem, steeper concepts.

**turbo default: Zod 4, bound via Standard-Schema-aware middleware so it's swappable.** `z.toJSONSchema()` is the
bridge to OpenAPI-first (see ecosystem-04).
