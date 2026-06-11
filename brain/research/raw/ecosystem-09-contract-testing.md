---
title: "Contract Testing — Pact vs Schema/OpenAPI vs Hono-RPC types (June 2026)"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [contract-testing, pact, openapi, consumer-driven, testing]
sources:
  - "WebSearch: contract testing 2026 (speakeasy, totalshiftleft, pactflow, docs.pact.io, stevekinney)"
summary: "'Schema valid' is weaker than 'compatible.' 2026 best practice: provider-owned OpenAPI contracts everywhere + spec-diffing + runtime conformance, and add consumer-driven (Pact) ONLY selectively. For turbo's TS-native edge: the Hono RPC `typeof app` type IS a compile-time contract; pair it with OpenAPI runtime conformance."
---

# The core distinction (the thing people conflate)
- **Schema testing** = "does this payload match the JSON Schema?" Tells you what shapes are *legal*.
- **Contract testing** = "are the shapes AND behaviors one side *relies on* still honored?" Checks the allowed
  set of interactions and lets the contract *evolve*. **"Schema valid" is strictly weaker than "compatible."**
  (Source: totalshiftleft.ai, stevekinney 2026.)

turbo, as a backend domain-expert, must know both AND know they're not interchangeable.

# The two families
## Consumer-Driven Contracts — Pact (code-first, consumer owns the contract)
- The **consumer** defines an interaction, runs its tests, and **generates a contract artifact**; the
  **provider** later proves it can satisfy that interaction (provider verification).
- Strength: catches "the provider removed a field MY client actually uses" even if the spec still says it's
  optional. Captures real consumer expectations, not just legal shapes.
- Cost: every consumer must write Pact tests; needs a broker (Pactflow) to share contracts; heavier setup.

## Schema/Provider-Driven — OpenAPI (provider owns the spec, guarantees it to consumers)
- The **provider-owned OpenAPI spec is the single source of truth**; the running implementation is validated
  against it (**runtime conformance**) and changes are caught via **spec diffing** (breaking-change detection).
- Strength: one artifact, easy to publish, generates SDKs/docs. Lower per-consumer cost.
- Weakness: "spec-compliant" ≠ "compatible with what consumer X relies on" — optional fields, error bodies, and
  consumer-specific subsets slip through.

# THE 2026 RECOMMENDATION (verbatim synthesis)
> _"If you're starting from scratch, use provider-owned contracts everywhere and add consumer-driven contracts
> selectively. For REST, that means OpenAPI plus spec diffing and runtime conformance tests."_ (speakeasy/
> totalshiftleft 2026.)

**Hybrid, weighted to provider-owned.** Add Pact ONLY where consumer-specific behavior matters enough that spec
compliance is too weak: optional fields, error-handling contracts, consumer-specific subsets, legacy
integrations, or **one provider serving many consumers with different expectations**.

# turbo's contract-testing stance (3 layers, cheapest-first)
1. **Compile-time contract (free, TS-native):** the **Hono RPC `typeof app` / `hc<AppType>`** type IS a contract
   between server and a TS consumer — a breaking server change becomes a *compile error* in the client. For
   internal TS-to-TS, this is the first and cheapest line. (Limit: only protects TS consumers, and only catches
   *type* drift, not behavioral/runtime drift — see Hono RPC gotchas, ecosystem-02.)
2. **Runtime conformance against OpenAPI (provider-owned):** because turbo generates OpenAPI from Zod
   (`@hono/zod-openapi`), add tests that **assert real responses validate against the generated spec** (the Zod
   schema validates at runtime anyway — assert the response parses). Add **spec diffing** in CI
   (e.g. `oasdiff` / openapi-diff) to fail the build on a breaking spec change. This is the main contract layer
   for external/non-TS consumers.
3. **Consumer-driven (Pact) — selective:** stand up Pact + a broker ONLY for the high-value seams where many
   independent consumers rely on subsets/error-shapes the spec can't pin (e.g. a public API with mobile + Python
   + partner consumers). Don't Pact-test everything — it's the expensive tool, used surgically.

# TS-specific tooling notes
- Generate JSON Schema from TS types via `typescript-json-schema` (consumer-driven schema-based flow), OR — the
  turbo-preferred direction — generate OpenAPI **from Zod** (`z.toJSONSchema()` / `@hono/zod-openapi`) so the
  validator and the contract are the same object (least drift).
- Spec-diff tools: `oasdiff`, `openapi-diff` — wire into CI to detect breaking changes between `/v1` revisions.
- Runtime assertion: validate sampled prod/test responses against the spec (the Zod parse already does this for
  turbo's own routes).

## The boundary (turbo vs the test-harness component)
turbo owns the **contract definition** (the OpenAPI spec generated from its Zod schemas + the RPC type) and the
**runtime-conformance + spec-diff** tests that prove its own routes honor it. Broader cross-service Pact
brokering and full integration-test orchestration is a fleet/test-infra concern, not turbo's to own — turbo's job
is to make its surface *contract-testable* (publish the spec, keep the Zod schema = the contract).
