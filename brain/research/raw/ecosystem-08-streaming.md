---
title: "Streaming — SSE vs WebSocket, Hono streaming helpers, the nginx-buffering trap (June 2026)"
type: concept
created: "2026-06-11"
updated: "2026-06-11"
tags: [streaming, sse, websocket, hono, llm, real-time]
sources:
  - "https://hono.dev/docs/helpers/streaming (fetched 2026-06-11)"
  - "WebSearch: SSE vs WebSocket AI streaming 2026 (websocket.org, procedure.tech, callsphere, buildmvpfast, render.com)"
  - "MDN Using server-sent events"
summary: "SSE wins for one-way LLM token streaming (OpenAI/Anthropic/Gemini ALL use SSE; HTTP/2 multiplexes; infra 'just works'). WebSocket for bidirectional/tool-use/multi-agent. Hono's streamSSE is Web-standard + runs on Node/Bun/Deno/Workers. THE production trap: nginx buffering — set X-Accel-Buffering:no. THE Hono gotcha: onError does NOT fire once a stream starts."
---

# The decision: SSE vs WebSocket (settled in 2026)

## Use **SSE** for one-way streaming (the default for LLM/agent output)
- **Every major LLM provider — OpenAI, Anthropic, Google Gemini — chose SSE over WebSockets** for token
  streaming. Token streaming is a **one-way** operation; SSE was literally designed for it (HTML Living
  Standard, 2012). (Source: procedure.tech, websocket.org 2026.)
- **HTTP/2 multiplexes all SSE streams over a single TCP connection.** WebSockets can't — they upgrade to a
  different protocol. So SSE scales connection-count better under HTTP/2.
- **Infra "just works":** every load balancer, CDN, reverse proxy understands HTTP. SSE only needs a config
  tweak to disable buffering on streaming routes. WebSockets need explicit upgrade support through the whole
  proxy chain.
- **Auto-reconnect is built in:** the browser `EventSource` reconnects automatically on drop and replays via
  `Last-Event-ID` — free resumability.

## Use **WebSocket** for bidirectional / interactive
- Tool-use round-trips, **interrupts** (stop generation), multi-turn agents, collaborative editing with AI
  suggestions, real-time agent dashboards with user controls, multi-agent message routing.
- Note the industry signal (websocket.org): some LLM stacks are *moving toward* WebSockets specifically to get
  **interrupts + tool-use** as agents become interactive. So: SSE for plain completion streaming; WebSocket when
  the client must talk back mid-stream.

**turbo rule:** default **SSE** for any agent/LLM output streaming surface (it matches Anthropic's own wire
format, which is on-brand for an Anthropic-aligned platform). Reach for **WebSocket** only when the product needs
client→server messages *during* the stream (interrupts, tool approvals, live collaboration).

---

# Hono streaming helpers (the load-bearing API) — source: hono.dev/docs/helpers/streaming

Import from `hono/streaming`. Three helpers, all **Web-standard** → identical on **Node, Bun, Deno, Workers**.

| Helper | Use | Key methods |
|---|---|---|
| `stream()` | raw binary stream | `write(uint8array)`, `pipe(readable)`, `onAbort(cb)` |
| `streamText()` | plain-text chunks (sets `Content-Type: text/plain`, `Transfer-Encoding: chunked`, `X-Content-Type-Options: nosniff`) | `write(text)`, `writeln(text)`, `sleep(ms)` |
| `streamSSE()` | Server-Sent Events | `writeSSE({ data, event, id })`, `sleep(ms)`, `onAbort(cb)` |

```ts
import { streamSSE } from 'hono/streaming'
app.get('/sse', (c) => streamSSE(c, async (stream) => {
  let id = 0
  stream.onAbort(() => console.log('Aborted!'))         // client disconnected
  while (!stream.aborted) {                              // stop when client leaves
    await stream.writeSSE({ data: token, event: 'message', id: String(id++) })  // id = resume token
    await stream.sleep(50)
  }
}, async (err, stream) => { /* OPTIONAL 3rd-arg error handler — see gotcha */ }))
```

## THE Hono streaming gotchas (the part that bites)
1. **`onError` does NOT fire once streaming starts (verbatim from docs):** _"if the callback function of the
   streaming helper throws an error, the `onError` event of Hono will not be triggered."_ Reason: the response
   headers/status are already sent — you can't turn a 200 stream into a 500. **You MUST pass the optional
   3rd-argument error handler** to `streamSSE`/`stream` and handle errors *inside* the stream (e.g. write an
   `event: error` SSE frame, then close). turbo rule: **every stream handler supplies the 3rd-arg error handler.**
2. **Detect disconnect with `stream.aborted` + `stream.onAbort()`.** Loop on `while (!stream.aborted)` so you
   stop generating tokens when the client navigates away — otherwise you burn LLM tokens into the void.
3. **Cloudflare Workers / Wrangler:** if `streamText()` malfunctions, set
   `c.header('Content-Encoding', 'Identity')` (disables compression that batches the stream).
4. **Response-body-one-shot footgun (issue #1695):** a `Response` body is a single-consumption stream; middleware
   that reads the body before the handler can leave it "disturbed or locked." Don't re-read a stream.

---

# THE #1 PRODUCTION TRAP: proxy buffering (nginx)
_"Nginx buffering is the single most common issue when deploying SSE-based LLM streaming."_ Nginx buffers
responses by default, batching chunks, so **tokens pile up and arrive as one giant dump** instead of streaming.
(Source: procedure.tech, buildmvpfast 2026.)
- **Fix:** send header **`X-Accel-Buffering: no`** (disables nginx buffering for that response). Also relevant:
  some CDNs/proxies need streaming explicitly enabled.
- **Required SSE response headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
  `Connection: keep-alive` (Hono's `streamSSE` sets the content-type; add the others + `X-Accel-Buffering: no`).

# Resumability + keep-alive (the robust-SSE recipe)
- **Resume:** client auto-sends `Last-Event-ID` header on reconnect; server reads it and **resumes from the last
  delivered `id`**. So emit a monotonic `id` on every frame and keep a short replay buffer if exactly-once-ish
  delivery matters. (echo's caching layer may back the replay buffer — seam noted.)
- **Keep-alive:** send a **comment line (`: ping`) every ~15s** when idle to stop proxies from killing the
  connection. The SSE frame fields are `event` / `data` / `id` / `retry` (retry overrides client reconnect
  delay).

## turbo's streaming checklist (for any streaming route)
- [ ] SSE for one-way (LLM/agent output); WebSocket only for bidirectional/interrupts.
- [ ] `streamSSE` with monotonic `id` (resume) + `stream.onAbort` (stop on disconnect) + **3rd-arg error handler**.
- [ ] Headers: `text/event-stream`, `no-cache`, `keep-alive`, **`X-Accel-Buffering: no`**.
- [ ] Keep-alive `: ping` every ~15s when idle.
- [ ] On Workers: `Content-Encoding: Identity` if streaming breaks.
- [ ] Never re-read a Response body (one-shot stream — issue #1695).
