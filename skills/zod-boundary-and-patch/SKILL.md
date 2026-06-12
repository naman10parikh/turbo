---
name: zod-boundary-and-patch
description: Validate at every boundary with Zod the right way — and never let a PATCH erase fields. Use when asked to "validate with Zod", "add a PATCH endpoint", "write the update schema", "parse the request body", or "migrate Zod v3 to v4". Encodes turbo's S-02 scenario + O-04 opinion + P-04/P-05 pitfalls — the 🔴 silent-data-loss class on partial updates.
---

# zod-boundary-and-patch

> Encodes scenario **S-02** (the PATCH that erased fields), opinion **O-04** (always a dedicated no-default PATCH schema; always bind validators through Standard Schema), and pitfalls **P-04** (Zod `.default()` data loss on PATCH) + **P-05** (the four mechanical Zod v3→v4 migration breaks). The 🔴 bug: reusing a create-schema to validate a PATCH silently overwrites omitted fields with their defaults.

## Trigger

Invoke when the user (or a coding agent) asks to:
- "validate with Zod" / "parse the request body" / "add Zod at the boundary"
- "add a PATCH / update endpoint" / "write the update schema"
- "migrate Zod v3 → v4" / "we bumped Zod and things broke"

## Steps

1. **Parse, don't validate, at every boundary.** Every route handler parses its input with Zod and returns a typed value (the energy law: Zod at every boundary, no `any`). The parsed object — not the raw body — flows downstream.
2. **The PATCH rule (the load-bearing one).** A PATCH/partial-update endpoint MUST use a **dedicated schema with NO `.default()`s** — never the create-schema. In **Zod 4**, `.default()` fires on `undefined` **unconditionally, even under `.partial()`** — so `CreateSchema.partial()` still resets every omitted defaulted field on save. Build the PATCH schema from a **no-default base** (or hand-author a distinct partial schema). The create schema keeps its defaults; the update schema has none.
   ```ts
   // create: defaults are correct here
   const CreatePet = z.object({ name: z.string(), status: z.enum([...]).default("available") });
   // update: a DISTINCT schema, NO .default() — omitted fields stay unchanged
   const UpdatePet = z.object({ name: z.string().optional(), status: z.enum([...]).optional() });
   ```
3. **Verify with the detector** (this guard is in the acceptance path itself):
   ```bash
   turbo audit <service-dir> --json
   ```
   Expect **zero P-04** — the create-schema and patch-schema must be distinct objects and the patch schema must have no `.default()`.
4. **Prove the behavior:** send a `PATCH` omitting a defaulted field; assert the stored value is **UNCHANGED** (not reset to the default).
5. **Bind through Standard Schema (O-04 second half).** Use `@hono/standard-validator` against the `~standard` interface so a Zod→Valibot swap is a package change with no route-code change — keep the validator choice open for when bundle size becomes binding. (Escape hatch: use the Zod-specific `@hono/zod-validator` when you want Zod's richer ergonomics and don't need swappability; `zod/mini` ONLY where edge bundle size is *measured*-critical.)
6. **If migrating v3→v4 (P-05), fix the four mechanical breaks:**
   - `z.coerce.number()` input type is now `unknown` → tighten the upstream type or accept `unknown` (the new TS errors are *correct*).
   - `z.string().email()/.url()/.uuid()` → `z.email()/z.url()/z.uuid()`; **`z.uuid()` is RFC-9562 strict** and rejects non-canonical UUIDs v3 accepted → use `z.guid()` for permissive matching, and **audit stored "UUIDs"** that aren't canonical.
   - `message`/`invalid_type_error`/`required_error`/`errorMap` collapsed into one `error` param; use `z.prettifyError()` for display.
   - `.merge()` removed → `.extend()` or `{ ...A.shape, ...B.shape }`; ensure `zod-validation-error ≥ v5.0.0`.

## Output

- the distinct create-schema vs patch-schema (patch has no `.default()`)
- `turbo audit` P-04 count (must be 0)
- the PATCH-omits-defaulted-field behavior result (value unchanged)
- if migrating: a checklist of the four P-05 breaks fixed, with the UUID-audit flag if `z.uuid()` is now strict
- the boundary note: validator bound via Standard Schema (swappable) unless Zod-specific ergonomics were deliberately chosen
