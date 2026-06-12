---
name: design-api-contract
description: Design the API contract — route by consumer (Hono RPC internal vs oRPC+OpenAPI external), generate OpenAPI FROM Zod, version with URL `/v1` additive-only, and be the 17% who actually contract-test. Use when asked to "design the API", "REST vs RPC", "how should I version this", "add OpenAPI", or "set up contract tests". Encodes turbo's O-07/O-08/O-10/O-11 opinions + S-06/S-12 scenarios.
---

# design-api-contract

> Encodes opinions **O-07** (route the API contract by consumer; the 2026 default is layered, not tribal), **O-08** (always OpenAPI-first, generated FROM Zod — the validator IS the contract), **O-10** (URL-path `/v1` + additive-only; never cargo-cult Stripe date-versioning below Stripe scale), **O-11** (be the 17%: never ship a versioned API without schema-enforced contract tests + a day-1 sunset policy), and scenarios **S-06** (versioning theater + zombie versions) / **S-12** (the Date that round-tripped as a string).

## Trigger

Invoke when the user (or a coding agent) asks to:
- "design the API" / "REST vs RPC" / "tRPC or REST?"
- "how should I version this API" / "add OpenAPI" / "publish a contract"
- "set up contract tests" / "stop the spec from drifting from the code"

## Steps

1. **Route by consumer (O-07) — the choice is layered, not tribal:**
   - **Internal, TS-only** → **Hono RPC** (`hcWithType`). This is the default for the acceptance-shaped (internal) case.
   - **External / mobile / non-TS / rich-types (Date/URL/Set/Map)** → **oRPC** (native rich types + first-class OpenAPI + edge/Workers; beats tRPC: 1.6× type-check, ½ bundle). Reserve oRPC as the `--external` escape hatch — wiring it by default would over-build.
   - Public REST + internal typed-RPC, layered. (tRPC only if already heavy on TanStack Query in a TS monorepo, accepting its OpenAPI plugin is deprecated + breaks on Edge.)
2. **Generate OpenAPI FROM Zod (O-08) — the validator IS the contract.** Use `@hono/zod-openapi` so one Zod object = runtime validation + published contract + typed client = least drift. A spec hand-maintained beside the code is a "dead document" that diverges (Val Town's exact regret, S-07). Serve `/openapi.json` + Scalar UI. The fastest path:
   ```bash
   turbo api --spec <openapi-or-zod-derived> --out <dir> --json   # OpenAPI → typed Hono service, Zod boundaries, /openapi.json, contract tests
   ```
3. **Version with URL-path `/v1`, additive-only (O-10).** `/v1` and `/v2` are separate cache keys for free, self-documenting, curl-able by agents and humans. **Additive within a major; breaking ⇒ `/vN+1`.** Do NOT cargo-cult Stripe date-versioning-with-transforms below Stripe scale — it's a major engineering investment with no credible small-scale success report. (Escape hatch: header versioning for internal service-to-service.) The cheapest version is the one you never cut — additive-only changes need no new version.
4. **Be the 17% (O-11) — contract tests + sunset policy, or it's theater.** 60% of teams version but only 17% contract-test; path versioning averages 2.3 zombie versions/service. Enforce:
   ```bash
   turbo contract <dir> --diff <prior-openapi.json>   # assert responses parse vs /openapi.json; oasdiff gate; RPC `typeof app` compile
   ```
   - **runtime conformance:** a sampled real response validates against `/openapi.json`.
   - **diff gate:** `oasdiff`/`openapi-diff` in CI fails on a breaking spec diff.
   - **day-1 sunset policy:** a deprecation header + a 12–24 month window written when `/v1` ships, not later. (Pact — consumer-driven — only for high-value seams with many independent consumers; don't Pact everything.)
5. **Handle the Date trap (S-12):** `JSON.stringify` serializes `Date` → string, so a Hono RPC client infers `createdAt: string`, not `Date`. Either parse ISO strings to `Date` on the client **and document the wire type as string in the contract**, OR use **oRPC** (handles Date/URL/Set/Map natively) when rich types matter pervasively — a concrete reason to prefer oRPC for external rich-type APIs.

## Output

- the consumer-routing decision (Hono RPC internal / oRPC external / layered REST) with the one-line reason
- the OpenAPI-from-Zod wiring (`/openapi.json` + Scalar served)
- the versioning scheme (URL `/v1`, additive-only) + the explicit "not date-versioning, here's why"
- the enforcement set: runtime conformance check · `oasdiff` CI gate · day-1 sunset policy + deprecation header
- the Date-handling decision (explicit ISO parse + documented wire type, or oRPC native)
- `turbo contract` result (conformant + no breaking diff)
