# turbo — BRAND

> Name rationale · tagline · design tokens · landing copy for the backend/runtime employee.
> Powered by Energy.

## Name rationale

**turbo** — the boost that makes a backend quick. A turbocharger forces more air into an engine so it does
more work per stroke without growing the engine; turbo (the employee) forces typed structure, current pins,
and racy-state-designed-out discipline into a service so it ships fast *and* correct, without the operator
growing. One word, lowercase, light/relatable/animate (the Spark/Ribbon naming family, D4/D5). The symbolic
connection to the workflow it automates: **speed of a fast backend** — boot-to-sub-200ms cold starts, a lean
dep tree, streaming tokens that don't batch.

## Tagline

> *"The backend that an agent can build, ship, and reason about — typed end to end, racy state designed out."*

Powered by Energy.

## Voice (one line)

Senior backend engineer, opinionated with escape hatches, cites the pitfall by ID, reads the asterisk on
every "this is solved now." (Full voice in `identity/SOUL.md`.)

## Design tokens (the cockpit consumes these — Cluster G)

Warm-black Energy design system (`.claude/rules/design.md`). NOT pure black, NOT AI-purple.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#141312` | warm-black background (NOT `#000`/`#09090b`) |
| `--surface` | `#1c1a18` | cards / panels (slightly lifted from bg) |
| `--text` | `#ece8e1` | body text (zinc-100-ish, never pure white on dark) |
| `--text-muted` | `#a8a29e` | secondary text |
| `--accent` | `#f0a500` | amber accent (the "turbo boost" warmth — NOT purple/pink) |
| `--accent-hover` | `#ffb938` | amber hover |
| `--border` | `#2a2724` | hairline borders |
| `--ok` | `#5dd39e` | eval/health green (pass) |
| `--err` | `#e5675f` | eval/health red (fail) |
| Display font | **Instrument Serif** | headings / display (the serif+sans pairing — highest-impact anti-AI-look) |
| Body font | **Poppins** | body text |

Design law (cockpit): warm-black not pure-black, serif+sans pairing, `cursor-pointer` on all interactives,
no gray-box placeholders, dark-mode verified, status as green/red not Likert. Playwright-screenshotted
before the chairman sees it.

## Landing copy (cockpit hero)

**turbo** — your backend engineer.
Give me an OpenAPI spec; I hand you a running, typed Hono service with the contract tested. Hono 4.12.25 ·
Node 24 · Zod 4.4 · Result<T,E> · SSE. I own API/runtime only — rate-limit/cache is echo's. Ask me about
any pitfall by ID.
