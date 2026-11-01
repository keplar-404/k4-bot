# K4 Bot: review, fixes and decisions

A record of the full-project review and the work that followed. It covers what was
wrong, what was changed, how it was verified, and what is still open.

## 1. Why the chat did not answer

The OpenRouter key was valid and paid models answered when called directly. The failures
came from the models offered in the picker and from how failures were reported:

| Cause | Detail |
|---|---|
| Gated model | `thinkingmachines/inkling:free` returns 403 ("only available on agentic harnesses"). The UI showed "check the API key". |
| Down model | `recursive/flint-v1.0:free` returned 503. |
| Shared free pool | The free Gemma models return 429 from a shared upstream pool, plus a daily cap on free models. |
| Wrong labels | Errors were classified by searching the message for digits ("404"), which matches request ids and URLs. They are now classified by the provider's HTTP status. |
| Relay bug | After a Durable Object was evicted, its event numbers restarted at 1 and the browser dropped every new event as a duplicate. |
| Client cursor | The browser started counting at 0 and replayed old events, which produced duplicate bubbles. |

A key detail: the OpenRouter **key** can have its own spending limit, separate from the account
balance. A capped key returns 402 once the cap is used. Check Settings → Keys.

## 2. What changed

### Backend (`apps/backend`)
- **Relay (`durable/chat-relay.ts`)**: the thread id is persisted in Durable Object storage and bound before
  the sequence counter is read. Every event is saved to `chat_event` before it is acknowledged, and replay
  always comes from the database. The in-memory buffer was removed.
- **WebSocket route**: the stub's 101 response has immutable headers, which the CORS and secure-headers
  middleware tried to modify. The route rebuilds the response.
- **Workflow (`workflows/chat-run.ts`)**: the agent runs in one step with no automatic retry (a retry would
  replay a half-streamed answer). Tokens are batched. Interrupts, usage and failures are read from where they
  actually appear in the stream. Any failure, including a timeout, publishes `run.failed` so the UI never
  waits forever. Usage recording can no longer fail a finished answer.
- **Stream parser (`agent/stream.ts`)**: only AI text reaches the transcript, never tool output.
- **Approvals**: `POST /chat/runs/:runId/resume` is implemented and resumes the checkpointed agent.
- **Checkpointer (`agent/checkpointer`)**: pending writes carry the task id, special channels use the
  library's fixed slots, blobs load by the exact version the checkpoint references, and writes are atomic
  (`db.batch`). Checkpoints are deleted when a bot is deleted.
- **Routes**: chat routes are split into `routes/chat/{threads,runs,realtime}`. Shared helpers are in
  `lib/threads.ts` (ownership, message order, daily quota) and `lib/validate.ts`.
- **Idempotent sends**: the client supplies a message id. The run id equals the message id, so a resend of a
  message the server already accepted does nothing. `retry: true` starts a new run for the same message.
- **Rate limiting**: Cloudflare's native Rate Limiting binding replaced the database limiter: `RL` (100/min per
  IP) and `RL_WRITE` (20/min per user). If the binding errors, requests are allowed and the error is logged once.
- **Auth and context**: Better Auth is built per request, so its background-task handler is never a stale
  request's. `COOKIE_DOMAIN` shares the session cookie across sibling subdomains. Email verification signs the
  user in automatically.
- **Env (`lib/env.ts`)**: `LANGSMITH_TRACING` uses `z.stringbool()` (`z.coerce.boolean()` turned `"false"` into
  true). `RUN_TIMEOUT_SECONDS` now sets the agent step timeout. `MAX_RUNS_PER_USER` defaults to 50.
- **Cleanup (`scheduled.ts`)**: a daily Cron Trigger deletes events older than 7 days but always keeps each
  thread's newest one, because the relay restores its numbering from `MAX(seq)`.
- **Models**: the catalog was pruned to models that answered, and the default always leads the list.
- **Migrations**: `apps/backend/drizzle/` holds the generated initial migration.
- **Removed**: Queues, R2, KV, the bot-task workflow, attachment routes, the database rate limiter, the
  guard middleware (the 32k input cap lives in the request schema), and a scratch agent script.

### Frontend (`apps/web`)
- **Chat hook (`lib/chat/use-chat.ts`)**: the stream cursor is seeded from history (`lastSeq`) and the socket
  resumes from it. A resync reloads history. Unsent messages survive a reload. Approve and Reject work. Retry
  works on failed answers.
- **Auto-resend**: a message that failed on a dropped connection resends itself with backoff, when the socket
  reopens, and when the browser reports it is online. An in-flight guard prevents double sends.
- **Errors (`lib/chat/stream.ts`)**: classification by HTTP status.
- **Chat view**: a "Thinking…" indicator, no empty failed bubbles, an approval bar that names the action.
- **Scrolling**: the chat page is now exactly one viewport tall, so only the conversation scrolls. Before, the
  document grew and scrolled instead.
- **Auth pages**: sign-up shows "check your email", the password-reset link is absolute, and the proxy uses
  Better Auth's cookie helper (it handles the `__Secure-` prefix on https).
- **Cleanup**: the fake team switcher and demo nav, the unused `verify-email` page, `ws-client.ts`, the unused
  `ai`, `@ai-sdk/react` and `@shadcn/helpers` dependencies, and the starter `packages/*` workspaces.
  `agentation` moved to regular dependencies so a production install can build.
- **Types**: `apps/backend/src/index.ts` now carries the `/// <reference>` to the Worker's ambient types. The web
  app's type-check relied on a file that was deleted.

### Docs and tooling
- Real `README.md` and a complete `.env.example`.
- `bun run --cwd apps/backend agent:chat [modelId]` talks to the Deep Agent in the terminal, with no web app or
  database.
- Backend scripts: `check`, `db:generate`, `db:migrate`, `db:push`.

## 3. How it was verified

| Check | Result |
|---|---|
| `tsc --noEmit` (both apps), `next build`, Worker bundle dry-run | pass |
| `check:relay-token`, `check:stream`, `check:chat` | pass |
| Live backend run (real model, real Neon, local Worker, throwaway user) | pass: streaming equals the saved message, gap-free event numbers, usage recorded, memory across turns, reconnect and full replay, approval pause then resume with tool events, unknown model rejected |
| Duplicate send, then `retry: true` | pass: one run for a duplicate, a second run for a retry |
| Forced 1-second agent timeout | pass: client receives `run.failed` |
| Event cleanup and the scheduled trigger | pass |
| Chat in the browser | confirmed working by the project owner |

Not verified: a real network drop in the browser, the Cloudflare rate-limit binding in production (it errors in
the local simulator and fails open), and anything that needs a deploy (`COOKIE_DOMAIN`, secrets).

## 4. Running and testing

```sh
bun install
cp .env.example apps/backend/.dev.vars     # fill in
bun run dev                                # web :3000, API :8787
bun run --cwd apps/backend agent:chat      # agent only, in the terminal
```

Manual checklist: sign up (the verification link prints in the API log without a Resend key), create a bot,
chat, scroll a long thread, ask for a file write and approve it, reload to confirm history, toggle Offline in
DevTools and back, and try a free model to see the 429 message.

On Windows, a stale `workerd` process can hold port 8787 and make requests hang. Stop it with
`taskkill /F /IM workerd.exe` and restart.

## 5. Decisions and answers recorded from the discussion

- **Cloudflare**: only Workers, Durable Objects, Workflows, Rate Limiting and Cron Triggers are used.
  Everything runs locally without a Cloudflare account. A deploy needs `wrangler login` or
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- **Free models in production**: they are a shared pool and will return 429. Production should use paid models
  (the default is Sonnet 4.6). Remove `:free` entries from `models.json` to offer only reliable ones.
  Automatic fallback to a paid model (`modelFallbackMiddleware`) was deliberately not added, because it would
  spend money without the user choosing it.
- **Queues**: not needed. Workflows give durable execution and retries; a Cron Trigger handles cleanup.
  Queues fit later work with no user waiting, such as bulk email or scheduled bot tasks.
- **Where data lives (Neon Postgres)**: `chat_message` (history), `chat_event` (live event log),
  `checkpoints*` (full agent state per step), `agent_usage` (tokens per run).
- **Caching**: no server-side cache (the data is per-user). There is a 5-minute session cookie cache, a 30-second
  client cache of the bot list, and `no-store` on the APIs.
- **shadcn**: the shadcn components were not the cause of the UI bugs. The problems were in the page layout and
  in project code around them. `prompt-bar.tsx` is a large custom component with demo leftovers; its
  attachments and microphone buttons are not connected.

## 6. Open items

1. Run `bun run --cwd apps/backend db:push` to drop the unused `api_rate_limit` and `bot_task` tables and the
   `cost_usd_est` column from an existing database.
2. Agent checkpoints are never deleted and the message list is stored again each time it changes, so long
   threads grow. A cleanup of old checkpoints will be needed eventually.
3. A retried failed turn adds the question to the agent's memory a second time.
4. The sign-in page ignores `callbackUrl` and always lands on `/dashboard`.
5. The OpenRouter key's own spending limit needs to be raised before it runs out.
6. `prompt-bar.tsx` still contains demo code (mock attachments, auto-demo, fallback model list).
