# 01 — Security, abuse and cost rules (apply to every change)

Threat model: an attacker can send anything to any public route; a signed-in user can try to reach other users' data; a **bot can be prompt-injected** by text it reads (emails, web pages, app results, workflow outputs); a bug or a malicious user can try to make the system loop and run up the bill (Cloudflare, OpenRouter, Composio, E2B, Tavily).

## 1. Lessons from real incidents (and what we do about them)

| Incident | What went wrong | Our rule |
|---|---|---|
| **n8n CVE-2026-1470, CVE-2026-25049** (CVSS 9.9): expression sandbox escape leading to RCE by anyone who could edit workflows ([vulert](https://vulert.com/vuln-db/CVE-2026-25049), [gcve](https://db.gcve.eu/cve/CVE-2026-1470)) | Workflow expressions were evaluated as JavaScript in a "sandbox" | **No code evaluation, ever.** `{{ }}` templates are path lookups only (`workflows/04`): no `eval`, `Function`, `vm`, or regex built from user input; `__proto__` / `constructor` / `prototype` are refused |
| **n8n CVE-2026-27493**: second-order expression injection, where form data submitted by an anonymous user was evaluated later ([watchstack](https://watchstack.io/intel/cve/CVE-2026-27493)) | Data from the outside was treated as a template | **Resolved values are never re-resolved.** Templates are resolved once, from the saved graph; a webhook body, app output or secret is data and never parsed as a template |
| **EchoLeak, CVE-2025-32711** (M365 Copilot, zero-click data exfiltration through an email) ([The Hacker News](https://thehackernews.com/2025/06/zero-click-ai-vulnerability-exposes.html)) | Untrusted content in context steered the agent to leak data | Tool results are labelled as data in prompts; writes need the user's approval in **Ask** mode; **secret values never enter model context**; outbound actions (send, post, HTTP) are logged |
| **GitHub MCP prompt-injection heist** (2025): a malicious public issue made the agent copy private repos into a public PR ([Docker](https://www.docker.com/blog/mcp-horror-stories-github-prompt-injection/), [UpGuard](https://www.upguard.com/blog/ai-github-agents-issue-leaked-private-repos)) | Broad tokens, plus approvals that users clicked through | **Least privilege per bot:** a bot only gets the apps the user enabled for it, read-only unless "can change things" is on. The approval card shows a human summary and the real target. "Allow all" is per chat and visible in the prompt bar |
| **Capital One 2019 SSRF**: a request to the cloud metadata IP leaked credentials | The server fetched attacker-chosen URLs | The HTTP block and any URL fetch use `checkUrl` + DNS checks + no redirects (`agent-platform/05`) |
| **Denial of wallet** (serverless billing abuse) ([Microsoft threat matrix](https://microsoft.github.io/Threat-Matrix-for-Cloud-Web-Applications/techniques/Denial%20of%20wallet/), [The Register](https://www.theregister.com/2021/04/21/denial_of_wallet/)) | Rate limits alone don't cap the bill; slow, steady abuse stays under them | **Rate limits and daily caps and per-run caps** (§4). Every paid call is counted in the DB before or as it is billed, like `generate_image` does today |

## 2. Input rules (never trust the frontend or anything outside the API)

1. **Every route input is validated with zod** through `validate("json" | "param" | "query", schema)`. Ids are `z.uuid()` (or the exact regex). Strings get `.max()`, arrays get `.max()`, numbers get `.int().min().max()`. Unknown keys are dropped (zod's default `object` strips them, so never use `.passthrough()`).
2. **Never take from the client what the server knows.** `userId` comes from the session, never the body. Bot, thread, workflow and run ownership is checked with a user-scoped query (`and(eq(id), eq(userId))`). The model id is checked against the catalog. The webhook URL, the OAuth callback URL, prices and limits are server-side. Example: `POST /composio/authorize` ignores any `callbackUrl`.
3. **Not yours → 404**, the same as missing (no id probing).
4. **Tool arguments from the model are untrusted input too.** Validate them with the tool's zod schema, then **re-check ownership on the server** inside the tool (as `sandbox_delete` re-checks name and purpose). Never let the model pass a `userId`, `botId` or another user's id.
5. **Re-validate at the trust boundary**, as the computer DO does with `computerActionSchema`: the engine re-validates a run's graph with `graphSchema` before executing it, even though it was validated on save.
6. **Size limits everywhere:** request body 1 MB (global), webhook 256 KB, step output stored ≤64 KB, tool output to the model ≤16 KB, template result ≤100 KB.
7. **Output encoding:** no HTML from users is ever rendered as HTML; file bytes are served with `Content-Security-Policy: sandbox` (as today); errors to users are short sentences, never stack traces or upstream bodies.

## 3. Authorization rules for the new features

- **A bot acts only as its owner**, only with apps the owner enabled for that bot (`bot_composio_app`), only with the owner's ACTIVE connected accounts.
- **A workflow run executes as the workflow owner.** A bot can run only workflows of the same user that are shared with it (or that it created).
- **Mode governs approval, not permission.** Allow-all never grants access a bot does not have; it only skips the confirmation step.
- **Hard stops apply in every mode:** budgets, rate limits, recursion depth, never-allowed actions (deleting the user's account, revealing secrets, turning off another user's resources).
- **Secrets:**
  - stored with `encryptSecret` (purpose `workflow-secret`, recordId = the secret row id);
  - decrypted only inside the engine step that needs them;
  - **never** in a tool result, a chat event, a step `input`/`output` row, a log line or an error message: redact the decrypted values from any text before storing or returning it;
  - the UI shows only the name and `secretHint`.

## 4. Limits (the user accepted these)

| What | Limit | Where |
|---|---|---|
| API requests | 100/min per IP | `RL` (exists) |
| Writes | 20/min per user | `RL_WRITE` (exists) |
| Workflow saves | 60/min per user | `RL_WF_SAVE` (exists) |
| Workflow run starts (user and bot) | 10/min per user | `RL_WF_RUN` (exists, wire it) |
| Webhook calls | 60/min per workflow, and per IP | new `RL_WF_HOOK` (ns 1005) |
| Bot app actions (Composio execute) | 30/min per user | new `RL_APP_EXEC` (ns 1006) |
| HTTP block requests | 30/min per user | new `RL_HTTP` (ns 1007) |
| Workflows | 100 per user, 25 active | `store/workflows.ts` (exists) |
| Workflow runs | 500/day per user, 5 concurrent per user, 30/hour per bot | `startRun` |
| Bot-created workflows | 10/day per bot | authoring tool |
| Steps per run | ≤50 nodes (schema), no loops | `graph/*` (exists) |
| Run duration | 8 days max; Delay ≤7 days | engine |
| Recursion | bot → workflow → bot depth ≤2 | `startRun` + tools |
| Secrets | 50 per user, value ≤4 KB | vault routes |
| Tokens, images, OCR, computer and sandbox minutes | existing env caps | unchanged |

When adding a paid or outbound call, add its cap here and enforce it in code, counted in the DB, so deleting things never resets a counter (see `agent_usage` rows that survive deletion).

## 5. Composio specifics

- One session per user (`userSession`).
  - **Add `sandbox: { enable: false }`** when creating it: Composio otherwise offers `COMPOSIO_REMOTE_BASH_TOOL` / `COMPOSIO_REMOTE_WORKBENCH`, which run code.
  - Keep `manageConnections: false`. Connecting happens only on the Connect page.
- Execute only with `composio.tools.execute(slug, { userId, connectedAccountId, arguments, version })`, as the owner, with a connection that `ownConnection` confirms is ACTIVE. Never use `dangerouslySkipVersionCheck`. Check the exact signature in `node_modules/@composio/core` (0.28).
- **Read vs write:** Composio tags tools with `readOnlyHint` / `createHint` / `updateHint` / `destructiveHint` (session option `tags`). Use the tool's tags when present (read them from `getRawComposioToolBySlug`). Otherwise use the slug-verb fallback in `agent-platform/01`. **Unknown means write.**
- Do **not** give bots Composio's meta-tools (`COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_PROXY_EXECUTE`, `COMPOSIO_MANAGE_CONNECTIONS`, remote bash/workbench). Use our own small tools so approvals and logging stay ours.
- Logos: keep `https://logos.composio.dev/api/<slug>` (no auth). The `logo_dev` toolkit needs its own API key and a connected account: not needed.

## 6. Checklist before any PR

- [ ] Every new route has `authGuard` (or a signed token / constant-time secret for a public route), zod on every input, a rate limit, and user-scoped queries.
- [ ] Every new tool validates its args, re-checks ownership, respects the mode, counts usage, clips its output, and never returns secrets.
- [ ] No new `eval` / `new Function` / dynamic regex built from user input.
- [ ] Cross-user test: user B gets 404 on user A's ids.
- [ ] The cost path has a cap that cannot be reset by deleting rows.
