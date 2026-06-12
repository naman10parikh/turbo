---
name: sse-streaming-safely
description: Stream LLM/agent tokens over SSE without the two bugs that bite every deploy — nginx buffering (tokens dump) and Hono onError not firing once the stream starts (silent truncation). Use when asked to "stream LLM tokens", "add an SSE endpoint", "build a streaming route", or "tokens arrive all at once / the stream just stops". Encodes turbo's S-08 scenario + O-12 opinion + P-10/P-11/P-12 pitfalls.
---

# sse-streaming-safely

> Encodes scenario **S-08** (the SSE stream that dumped and swallowed its error), opinion **O-12** (default to SSE for agent/LLM output; always the 3rd-arg error handler + `X-Accel-Buffering: no`), and pitfalls **P-10** (tokens batch behind nginx), **P-11** (Hono `onError` does NOT fire once a stream starts), **P-12** (response body is one-shot). The two failures bite *every* SSE deploy.

## Trigger

Invoke when the user (or a coding agent) asks to:
- "stream LLM tokens" / "add an SSE / streaming endpoint" / "build a streaming route"
- "tokens arrive all at once" (the nginx-buffering symptom) / "the stream just stops with no error" (the onError symptom)
- anything where an agent/LLM emits tokens incrementally to a client.

(Reach for WebSocket instead ONLY when the client must talk back *during* the stream — interrupts/stop-generation, tool-use approvals, multi-agent routing, live collaboration.)

## Steps

1. **Default to SSE for one-way token streaming.** OpenAI/Anthropic/Gemini all use SSE; HTTP/2 multiplexes; `EventSource` auto-reconnects via `Last-Event-ID`. Use Hono `streamSSE`.
2. **Audit the route file with the detector first:**
   ```bash
   turbo stream-doctor <route-file>
   ```
   It flags the SSE traps: missing 3rd-arg error handler, missing `X-Accel-Buffering: no`, no `while (!stream.aborted)` loop, and re-read body. Expect it to report **P-10 and P-11** on a naive route.
3. **Fix P-10 (nginx buffering — the #1 SSE prod issue):** set the headers so the proxy stops buffering:
   ```
   X-Accel-Buffering: no
   Content-Type: text/event-stream
   Cache-Control: no-cache
   Connection: keep-alive
   ```
   On Cloudflare Workers, set `Content-Encoding: Identity` if `streamText` malfunctions.
4. **Fix P-11 (onError doesn't fire mid-stream):** once headers/status are sent you cannot turn 200 into 500, so `app.onError` will NOT catch a throw inside the stream callback. **Pass the optional 3rd-arg error handler** to `streamSSE`; on error, write an `event: error` SSE frame, then close. A route-level `try/catch` around the whole handler does NOT help — the stream already started.
5. **Stop burning tokens on disconnect:** loop `while (!stream.aborted)` + register `stream.onAbort()` so generation stops when the client leaves. Emit a monotonic `id` for `Last-Event-ID` resume; send `: ping` every ~15s when idle.
6. **Never re-read the body (P-12):** a Fetch `Response` body is one-shot — `res.clone()` before reading, or read once and pass the parsed value downstream. Body-inspecting middleware that reads the body before the handler also reads it triggers *"disturbed or locked."*
7. **Verify the behavior (the binary gate):** tokens arrive **incrementally** through the proxy (not batched); an injected in-stream error produces an `event: error` frame + clean close (not silent truncation); a client disconnect stops token generation.

## Output

- `turbo stream-doctor` findings (P-10/P-11 cleared)
- the streaming route with: the four buffering headers, the 3rd-arg error handler writing `event: error`, the `while (!stream.aborted)` loop + `onAbort`, monotonic `id`s
- the three behavior checks: incremental delivery through the proxy · injected error → `event: error` frame + clean close · disconnect stops generation
- a note if WebSocket was considered (and why SSE was kept, or why WS is justified for bidirectional)
