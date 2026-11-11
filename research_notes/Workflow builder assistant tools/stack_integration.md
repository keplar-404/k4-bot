# Stack integration: durable AI assistant on Cloudflare Workers + Workflows + DO, Hono, Neon/Drizzle, Better Auth, Next.js 16 + shadcn AI Elements

Repo context read (as of 2026-11-11): `apps/backend/wrangler.jsonc`, `apps/backend/src/modules/assistant/{workflow,slice,routes}.ts`, `apps/backend/src/modules/chat/run/workflow.ts`, plus a grep that found `NeonHttpCheckpointer` in `modules/agent/checkpointer/neon-http-checkpointer.ts`. The README and the `.agents/skills/*/SKILL.md` files were not read: a glob of `.agents/skills/*/SKILL.md` matched nothing, so those skills may live at another path, and the README was skipped to save time.

Current repo design:
- `AssistantRunWorkflow` runs one turn as a loop of up to 40 "slices". Each slice is a `step.do` with `retries.limit: 0` and a 25-minute timeout, and drives a LangGraph agent with `recursionLimit = RUN_SLICE_STEPS` and a 20-minute wall clock.
- State is checkpointed to Neon over HTTP. The next slice resumes from that checkpoint (`input = { kind: "continue" }`).
- Human confirmations use `step.waitForEvent("assistant-input", 7 days)`. Transient model errors trigger `step.sleep` with backoff.
- Progress (todos only) is written to Postgres and pushed to a DO relay (`WORKFLOW_LIVE` / `liveAssistant`).
- Stop is handled by polling the DB every 1.5 s inside the slice, plus a `sendEvent({stop})` when the run is waiting.
- Routes (Hono): `authGuard`, Zod `validate`, one active run per user (409 BUSY), a daily token budget (429), `RL_ASSISTANT_MSG` at 10/min, and the run started with a `runId` as the Workflow instance id (`ASSISTANT_RUN.create({id: runId})`). Starting this way gives idempotent creation.
- wrangler: `limits.cpu_ms: 300000`, `subrequests: 1000000`, 8 rate-limit namespaces, and SQLite-backed DOs.

## Q1. Cloudflare Workflows for agent runs, and the Agents SDK as an alternative

### Takeaway
The repo's design is Workflows plus a DO relay, with bounded slices, an external checkpoint and `waitForEvent` for HITL. It fits the documented Workflows model well: steps are cached by name, waits are free, and the per-instance limits are generous on Paid. The Agents SDK (`AIChatAgent`) would give built-in chat persistence and resumable WebSocket streaming. Its own docs still recommend pairing it with Workflows for multi-step, retry-heavy or human-in-the-loop work.

### Cited Findings
- Steps per Workflow are 1,024 on Free and 10,000 on Paid by default, configurable up to 25,000. `step.sleep` does not count toward this limit. — [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
- Wall-clock time per step is not listed as a limit. CPU per step is 30 s by default on Paid, configurable up to 5 min via `limits.cpu_ms`. — [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
- Subrequests are 10,000 by default on Paid, configurable up to 10 million. State is 1 GB per instance on Paid. A non-stream `step.do` return is capped at 1 MiB. `step.sleep` can last up to 365 days. Event payloads are capped at 1 MiB. — [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
- Concurrency is 50,000 instances per account on Paid. Instances that are `waiting` or `paused` do not count toward it. Completed instances are retained 7 days by default, configurable up to 30. — [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
- Default step config is 5 retries, a 10 s initial delay, exponential backoff and a 10-minute timeout. The timeout applies per attempt. Delays can be functions (changelog dated 2026-07-09). — [Sleeping and retrying](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/); [Changelog](https://developers.cloudflare.com/changelog/post/2026-07-09-dynamic-retry-delays/)
- The docs disagree on whether `retries.limit` counts total attempts or retries (a limit of 10 meaning 11 attempts). — [Sleeping and retrying](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/) vs [llms-full](https://developers.cloudflare.com/workflows/llms-full.txt)
- Rules of Workflows:
  - Steps must be idempotent, because they can be retried.
  - Step names are the cache key, so they must be deterministic. Names derived from earlier step output are fine.
  - Don't rely on in-memory state outside steps. Wrap non-determinism and side effects in steps.
  - Don't nest `waitForEvent` or `sleep` inside `step.do`.
  - Use `waitForEvent` rather than a step timeout longer than 30 minutes.

  — [Rules of Workflows](https://developers.cloudflare.com/workflows/build/rules-of-workflows/)
- Agents SDK, `AIChatAgent` (from `@cloudflare/ai-chat`) with `useAgentChat`:
  - It runs on a Durable Object and keeps messages in SQLite.
  - Stream chunks are buffered in SQLite, and "Streams automatically resume when a client disconnects and reconnects".
  - `runFiber()` / `onChatRecovery` recover a turn after DO eviction.
  - It supports `needsApproval` tools, `messageConcurrency` (default "queue") and recovery budgets (`maxAttempts` 10, `noProgressTimeoutMs` 5 min). Turns waiting on a human are exempt from those budgets.
  - SQLite rows are capped at 2 MB, and compaction starts near 1.8 MB.
  - You must forward `abortSignal` to `streamText`, or the LLM call keeps running after cancel.

  — [Chat agents](https://developers.cloudflare.com/agents/agent-class/communication-channels/chat/chat-agents/)
- Cloudflare's guidance on choosing between them:
  - Agents alone suit chat and tasks under 30 s.
  - Agents plus Workflows suit multi-step operations, human-in-the-loop approvals and guaranteed delivery.
  - `AgentWorkflow` provides `runWorkflow`, `sendWorkflowEvent`, `approveWorkflow` and `reportProgress` (non-durable, may repeat), plus `step.mergeAgentState()` (durable).

  — [Using Agents with Workflows](https://developers.cloudflare.com/agents/concepts/workflows/)
- The Agents SDK has a durable Streams capability (a chunk log with replay from a cursor and SSE resume) and a Sessions capability (conversation history in a DO). — [Agents llms.txt index](https://developers.cloudflare.com/agents/llms.txt)

### Inferences
- `retries.limit: 0` on slices is correct, because a slice edits the canvas and is not idempotent. The risk is that a platform-level failure kills the slice. That case is caught by the outer `try`, and the run is reported failed rather than retried. A safer variant would make canvas edits idempotent (keyed by tool-call id), so slices could take 1 or 2 retries.
- The step names are deterministic (`slice-${n}`, `answer-${n}`), which is compliant.
- The 25-minute slice timeout is under the 30-minute guidance. CPU, at 300,000 ms, is at the maximum.
- The Workflow loop calls `setRun`/`addMessage` inside steps, which is correct. The `todos` variable is rebuilt only from step returns, which is also correct.
- The 1.5 s stop poll hits Neon about 800 times per 20-minute slice. An alternative is to have the DO relay hold a stop flag and push it, or to check between graph steps.
- If you migrate to `AIChatAgent`, you would lose the Postgres-as-source-of-truth model (history moves to per-DO SQLite). You would gain built-in resumable streaming. A hybrid is possible: an Agent as the per-user/thread connection and stream hub, `runWorkflow` for long turns, and Neon kept for queryable history.

### Gaps
- The maximum `waitForEvent` timeout is not stated on the limits page. The repo uses 7 days.
- Whether Workflows "steps per instance" counts `waitForEvent` was not checked.

## Q2. Streaming to the browser: DO WebSocket hibernation, SSE, resumable streams

### Takeaway
Use a DO that accepts WebSockets through the Hibernation API as the fan-out relay, which is what the repo already does. Add a sequence number or cursor and a durable chunk log so a reconnecting client can replay what it missed. The AI SDK's resumable streams need an `activeStreamId` per chat and a separate stop endpoint.

### Cited Findings
- `ctx.acceptWebSocket()` allows hibernation, and "Billable Duration (GB-s) charges do not accrue during hibernation". Ping/pong is handled automatically without waking the DO. — [DO WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- Alarms, incoming requests and `setTimeout`/`setInterval` prevent hibernation. Batch messages every 50 to 100 ms. Per-connection attachments are capped at 16 KB and are lost when the connection closes. Deploys can disconnect sockets. — [DO WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- With AI SDK `useChat` and `resume: true`, the client sends a GET to `/api/chat/[id]/stream` on mount.
  - The server uses the `resumable-stream` package, with Redis as the backing store.
  - The app must persist `activeStreamId` and return 204 when no stream is active.
  - Client aborts are treated as disconnects, so a real Stop needs a dedicated endpoint, and the client should not auto-reconnect after Stop.

  — [AI SDK resume streams](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams)
- The Agents SDK Streams capability provides a durable chunk log with replay from a cursor and SSE resume. — [Agents llms.txt](https://developers.cloudflare.com/agents/llms.txt)

### Inferences
- The repo pushes only todos and status live, and saves the final answer at the end. That makes reconnect trivial: the reopened page reads the run row via `GET /threads/:id`. The trade-off is that there is no token-level streaming.
- To add token streaming durably, append chunks with a monotonic seq to DO SQLite in the `WorkflowRunRelay`/`ChatRelay`. Clients reconnect with `?after=seq`. This removes the need for Redis.
- The Workflow cannot hold a WebSocket itself, so it must publish to the DO via RPC/fetch. The repo already does this.

### Gaps
- I did not verify whether `resumable-stream` has a non-Redis (DO or KV) adapter.

## Q3. LangGraph checkpoints in Neon via Drizzle

### Takeaway
On Workers, the stock `PostgresSaver` (pg over TCP) is avoided. The repo instead uses a custom `NeonHttpCheckpointer` on Drizzle `neon-http`. The HTTP driver supports only single queries or non-interactive batches, not interactive transactions. Checkpoint writes therefore need to be designed as single statements or `batch`es, or they need the WebSocket `Pool` driver.

### Cited Findings
- Neon HTTP mode runs single queries and non-interactive transaction batches with no session state. Interactive transactions and session features need WebSocket mode (`neon-serverless` Pool). — [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver); [Drizzle connect-neon](https://orm.drizzle.team/docs/connect-neon)
- Drizzle Kit migrations need a standard Postgres driver, not the Neon serverless driver. This comes from a third-party summary; verify it. — [Drizzle connect-neon](https://orm.drizzle.team/docs/connect-neon)
- A repo code comment says the stock PostgresSaver needs a raw TCP socket. This is a repo statement, not externally verified; Workers now offers `connect()` TCP sockets and Hyperdrive. — repo `neon-http-checkpointer.ts` line 20

### Inferences
- With `put` + `putWrites` and no transaction, a crash between them could leave partial writes. LangGraph tolerates pending writes, but `db.batch([...])` makes them atomic over HTTP.
- Long-term memory is currently a single 8 KB text blob per user (`/memory`). A LangGraph `Store`-style table keyed by (namespace, key) with JSONB, or pgvector, would scale better.
- Prune checkpoints per thread. The repo's `cleanup.ts` already deletes them for deleted threads.

### Gaps
- I did not fetch the LangGraph JS docs for `PostgresStore` on Workers or Hyperdrive compatibility.
- I did not check the Neon docs for current HTTP batch size limits.

## Q4. Hono patterns: Better Auth, rate limiting, Zod

### Takeaway
The repo follows the documented patterns: a session middleware, Zod validators and per-user rate-limit keys. Cloudflare's rate-limit binding is approximate and per-location. Strict per-user caps (one active run, daily tokens) must live in Postgres or a DO, which is what the repo does.

### Cited Findings
- Better Auth on Hono:
  - Mount `app.all("/api/auth/*", c => auth.handler(c.req.raw))`.
  - Register `cors()` before the auth route, with an explicit origin and `credentials: true`, and list the same origin in `trustedOrigins`.
  - The session middleware calls `auth.api.getSession({ headers: c.req.raw.headers })` and stores the result with `c.set("session")`.

  — [Better Auth Hono](https://better-auth.com/docs/integrations/hono)
- Rate-limit binding behavior:
  - `period` must be 10 or 60 s.
  - Counts are kept per Cloudflare location and are eventually consistent, so limits are approximate.
  - Bindings that share a `namespace_id` share counters.
  - Key on user, tenant or API key rather than IP.
  - For strict limits, use a Durable Object.

  — [Rate limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

### Inferences
- The global `RL` binding is keyed per IP, which the docs advise against for authenticated routes. That is acceptable as coarse DDoS protection only.
- `activeRunOf` followed by an insert is a check-then-act race. Two concurrent POSTs could both pass. A partial unique index on `assistant_run(user_id) WHERE status IN ('queued','running','waiting')` would make the check atomic.

### Gaps
- The Better Auth Workers-specific guide was not fetched.

## Q5. Next.js 16 + shadcn/ui + AI Elements chat UI

### Takeaway
AI Elements has 49 components covering everything the panel needs: Conversation, Message, Prompt Input, Attachments, Model Selector, Task, Plan, Queue, Tool, Confirmation, Reasoning and Checkpoint. It is moving into shadcn/ui, and the standalone elements.ai-sdk.dev is slated for deprecation at the end of November 2026, so install from the shadcn registry.

### Cited Findings
- AI Elements components:
  - Chatbot: Attachments, Chain of Thought, Checkpoint, Confirmation, Context, Conversation, Inline Citation, Message, Model Selector, Plan, Prompt Input, Question, Queue, Reasoning, Shimmer, Sources, Suggestion, Task, Tool.
  - Workflow: Canvas, Node, Edge and others.
  - The site says it is moving to shadcn/ui and will be deprecated at the end of November 2026.

  — [AI Elements](https://elements.ai-sdk.dev/)
- shadcn's AI Elements are copied-in patterns, installed with `npx shadcn@latest add <name>`. The list includes Chat, Plan, Task, Queue, Tool, Confirmation, Model Selector, Prompt Input and Subagent. — [shadcn AI Elements](https://ui.shadcn.com/docs/ai-elements)
- `useAgentChat` wraps AI SDK `useChat` over a WebSocket transport (statuses, `addToolApprovalResponse`, `isRecovering`). — [Chat agents](https://developers.cloudflare.com/agents/agent-class/communication-channels/chat/chat-agents/)

### Inferences
- The repo's run is not an AI SDK UIMessage stream: it uses custom todos, waiting cards and a final answer. A custom store fed by the DO WebSocket plus `GET /threads/:id` is simpler than adapting to `useChat`, unless token streaming is added.
- Map the repo's pieces onto components this way:
  - todos to Plan/Task/Queue
  - waiting `question` to Confirmation
  - the model list to Model Selector
  - `fileIds` to Prompt Input attachments

### Gaps
- The `@shadcn/helpers/ai-sdk` `createChat` API is not documented on the page I fetched.

## Q6. Cost and abuse controls

### Takeaway
The repo's layered controls (per-route rate limits, one active run per user, a daily token budget checked before each slice, a max slice count and recorded usage) match platform guidance. Remaining gaps are the race on concurrent starts and per-slice cost ceilings.

### Cited Findings
- Rate-limit bindings are approximate, so a strict quota should use a DO counter. — [Rate limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- Waiting or paused Workflow instances don't count toward concurrency, so long HITL waits are cheap. — [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
- An unforwarded abort signal keeps LLM calls running after a cancel. — [Chat agents](https://developers.cloudflare.com/agents/agent-class/communication-channels/chat/chat-agents/)

### Inferences
- The budget is checked at slice start only. One slice can overshoot by up to a full slice of tokens. Consider a per-run token cap, checked in the stream loop the same way usage is counted.
- The repo already passes `signal` to `agent.stream`, which is good.
- Raised subrequest and CPU limits increase the blast radius of a runaway run. `MAX_SLICES = 40` × 20 minutes is roughly 13 hours of agent time per turn, which may be more than you want for a builder assistant.

### Gaps
- No per-user dollar or cost estimates were gathered.
