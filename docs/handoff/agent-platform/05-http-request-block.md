# 05 — HTTP request block (approved by the user)

Lets a workflow call any website or API that Composio does not cover.

## Node (`modules/workflows/graph/schema.ts`)
```ts
kind: "action.http",
config: {
  method: z.enum(["GET","POST","PUT","PATCH","DELETE"]),
  url: template(2048),                                  // may contain {{…}} incl. {{secrets.X}} in the query
  headers: z.array(z.object({ name: z.string().regex(/^[A-Za-z0-9-]{1,64}$/), value: template(2000) })).max(10).default([]),
  body: z.object({ type: z.enum(["none","json","text","form"]), value: template(20_000) }).default({ type: "none", value: "" }),
  timeoutSeconds: z.number().int().min(1).max(30).default(15),
  expect: z.enum(["json","text"]).default("json"),
},
retry: retrySchema.optional(), onError: z.enum(["stop","continue"]).default("stop"),
```
`publishIssues`: the URL must be present. Refuse the header names `host`, `content-length`, `cookie`, `connection`, `transfer-encoding`, `x-k4-*`.

## Execution (`engine/blocks/http.ts` + `engine/http-guard.ts`, pure parts tested in `http-guard.check.ts`)
1. Resolve templates (including secrets) → validate the final URL with **`checkUrl`** from `modules/computer/guards/network.ts`:
   - http(s) only, no credentials in the URL, no internal names, no private IPv4 (decimal and hex forms are canonicalised by `new URL`), no IPv6 literals.
   - **Also https only for production** (allow http only if `env` says dev).
   - **Refuse our own hosts** (`BETTER_AUTH_URL`, `WEB_ORIGIN` hostnames) so a workflow cannot call our API or webhooks (loop and auth confusion).
2. DNS rebinding: Workers `fetch` resolves DNS itself and Cloudflare blocks private ranges from Workers. Still refuse hostnames that resolve to private ranges where a lookup is possible. Optional: DNS-over-HTTPS `https://cloudflare-dns.com/dns-query?name=…&type=A`, checking the answers against `PRIVATE_V4` and `DENY_OUT`.
3. `fetch(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(timeoutSeconds*1000) })`. A 3xx → re-validate the `Location` with the same checks, at most 3 hops.
4. Add the headers `user-agent: k4-workflows/1.0` and `x-k4-workflow-run: <runId>`.
5. Read at most **1 MB** (stream and count; abort beyond). Parse JSON if `expect: json` (fall back to text). The output is `{status, headers: <allowlisted content-type/content-length>, body}`, truncated to 64 KB when stored.
6. 4xx → `NonRetryableError` (except 408/429); 5xx, network and timeout → retryable.
7. Count usage: `RL_HTTP` (30/min per user); `agent_usage`-style row optional.
8. **Redact secrets** from the stored input, the output and errors (`03` §A).

## Builder UI (`features/workflows/builder/settings/http-settings.tsx` + small parts)
- Method select + URL input (with reference chips), a headers key/value list, a body type select + textarea (JSON validated live), timeout, and Retry/On-error (reuse `retry-settings`).
- A secret picker that inserts `{{secrets.NAME}}` (lists `GET /secrets`, plus "Add secret" with a password input → `PUT /secrets/:name`).
- Library: in the "Logic" group, or a new "Built-in" group: "HTTP request — Call any API".
- `block-catalog.ts` entry, `newBlock` default (`GET`, empty URL), `block-label.ts`.

## Done when
- GET `https://httpbin.org/json` works; POST with a JSON body and a `{{secrets.TOKEN}}` header works, and the run viewer shows `[secret:TOKEN]`.
- `http://169.254.169.254/`, `http://127.0.0.1`, `http://2130706433`, `http://localhost:8787`, our own API host and a redirect to a private IP are all refused with a readable error.
- A 5 MB response is cut at 1 MB with a note; a slow server times out at the set timeout.
