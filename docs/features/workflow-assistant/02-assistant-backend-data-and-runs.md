# 02 — Workflow Assistant: data, durable runs, relay, routes

> **Status: DONE, with changes** (2026-11-11)
> - Done: tables `assistant_thread`, `assistant_message`, `assistant_run`, `assistant_memory` + `workflow.assistant_run_id`
>   (`src/db/schema/assistant.ts`, migration `drizzle/0025_clammy_shiver_man.sql` — **generated, not applied**: run
>   `bun run --cwd apps/backend db:migrate` or `db:push`). Usage goes to `agent_usage` (`run_id = assistant:<id>`), so it counts
>   toward the daily budget. Durable run `AssistantRunWorkflow` (`modules/assistant/workflow.ts` + `slice.ts`): slices, Stop
>   polling, confirmations via `waitForEvent`, lock released on every exit. Routes in `modules/assistant/routes.ts`
>   (threads CRUD, messages, `runs/:id/answer`, `runs/:id/stop`, memory). Bindings in `wrangler.jsonc` + `config/env.ts`.
> - Changed: **no separate relay Durable Object**. Progress is pushed over the workflow’s existing `WORKFLOW_LIVE` socket
>   (new `assistant.progress` event); the panel also re-reads the thread every 4 s while a run is active (covers a run on
>   another workflow and missed events). No `/live-token` route needed. The answer is saved at the end (not token-streamed).

The assistant is a chat that lives only on the workflow builder page. Its runs must survive a closed tab: they run as
a **Cloudflare Workflow** (like bot chat), checkpoint the agent in Postgres, and stream to an open panel through a
**Durable Object relay**. When the user returns, the panel loads history + the current run's state from the database.

Copy the bot chat pattern; do not import chat modules directly (keep the assistant separate, per product decision).
Reference implementation: `apps/backend/src/modules/chat/run/workflow.ts` (`ChatRunWorkflow`), `chat/run/slice.ts`,
`chat/run/recorder.ts`, `chat/relay/*`, `chat/routes/*`.

New module: `apps/backend/src/modules/assistant/`.

## 1. Tables (`apps/backend/src/db/schema/assistant.ts`, export from `schema/index.ts`)

- [ ] `assistant_thread`: `id uuid pk`, `user_id` (fk user, cascade), `title text` (first message, ≤ 80 chars,
      editable later), `workflow_id uuid null` (fk workflow, **set null** on delete: the workflow the chat is about;
      updated when the user chats from another workflow), `model_id text`, `created_at`, `updated_at`.
      Index `(user_id, updated_at desc)`.
- [ ] `assistant_message`: `id uuid pk`, `thread_id` (fk, cascade), `user_id`, `role` (`user` | `assistant`),
      `content text` (user text or final answer markdown), `files jsonb` (stored file ids + names + mime for user
      uploads), `todos jsonb` (the final todo list snapshot for that assistant turn: `[{ content, status }]`),
      `run_id uuid null`, `created_at`. Index `(thread_id, created_at)`.
- [ ] `assistant_run`: `id uuid pk` (also the Cloudflare Workflow instance id), `thread_id`, `user_id`,
      `workflow_id`, `status` (`queued | running | succeeded | failed | cancelled`), `todos jsonb` (live list),
      `error text null`, `started_at`, `finished_at`, `tokens_in int`, `tokens_out int`.
      Index `(user_id, status)` — at most **one active run per user** (enforced in code, see 06).
- [ ] `assistant_memory`: `user_id pk`, `content text` (≤ 8 KB), `updated_at`. Per user, across workflows.
- [ ] Usage: record tokens in the **same** table/function the chat uses for the daily budget
      (`tokensUsedToday` — find it from `chat/run/slice.ts`) so assistant usage counts toward
      `MAX_DAILY_TOKENS_PER_USER`. Add a `source: "assistant"` column/value if the usage table has a kind column.
- [ ] `bun run --cwd apps/backend db:generate`, review the SQL, commit migration + snapshot.

## 2. Durable run (`assistant/run/workflow.ts`)

- [ ] `AssistantRunWorkflow extends WorkflowEntrypoint<Env, AssistantRunParams>` with params
      `{ runId, threadId, userId, workflowId, modelId }` (ids only; read everything else from the DB in steps).
- [ ] Register in `apps/backend/wrangler.jsonc` → `workflows`: `{ "name": "assistant-run", "binding":
      "ASSISTANT_RUN", "class_name": "AssistantRunWorkflow" }`; export the class from `src/index.ts` (names fixed by
      wrangler); add `ASSISTANT_RUN: Workflow` to `Env` in `config/env.ts`.
- [ ] Steps, mirroring `ChatRunWorkflow.execute`:
      1. `load-context`: thread, last N messages (cap by characters, e.g. 40 messages / 60 KB), user memory, the
         workflow (`getWorkflow`, owner check), the user's models choice.
      2. `start-run`: set `assistant_run.status = running`, take the **canvas lock** (doc 04).
      3. Loop of **slices** (`step.do("slice:<n>")`), each driving the agent up to `RUN_SLICE_STEPS` graph steps
         with the Postgres checkpointer (`agent/checkpointer`), thread id `assistant:<threadId>`. Same retry rules
         as chat (`MAX_MODEL_RETRIES`, `retryDelayMs`).
      4. Between slices: check `assistant_run.status === "cancelled"` (Stop button) and the daily token budget.
      5. `finish`: save the assistant message (final answer + final todos snapshot), set status, **release the
         canvas lock**, publish `run.finished`.
      6. `catch`: like chat's `report-failure`: mark failed, release lock, publish `run.failed`. The lock must be
         released on every path (put it in a `finally`-style final step).
- [ ] Each slice publishes only **user-facing** events (doc 05): todo list changes, answer tokens, status. Never tool
      calls or arguments.
- [ ] Cap a run: `MAX_ASSISTANT_SLICES` (e.g. 40) and wall clock (e.g. 30 min); then stop with a clear message.

## 3. Relay (`assistant/relay/*`)

One Durable Object **per user** (all their assistant threads), so one socket serves the panel on any workflow page.

- [ ] Copy the `ChatRelay` design (`chat/relay/index.ts`, `sockets.ts`, `events.ts`, `access.ts`): numbered events
      (gap-free `seq`), short buffer, resume from last `seq`, otherwise the client reloads over HTTP.
- [ ] Binding `ASSISTANT_RELAY` (`AssistantRelay` class) in `wrangler.jsonc` `durable_objects.bindings` **and a new
      `migrations` entry** (`new_sqlite_classes` / `new_classes`, match how existing DOs were added — read the
      migrations block in `wrangler.jsonc`).
- [ ] Socket auth: signed short-lived token like `workflows/live/token.ts` (`POST /assistant/live-token` → token →
      `GET /assistant/live?token=`). The DO accepts only that user's token.
- [ ] Event types (`assistant/relay/events.ts`, plain literal types so the web can import them):
      ```ts
      type AssistantEvent =
        | { type: "run.started"; runId; threadId; at }
        | { type: "todos"; runId; todos: { content: string; status: "pending" | "in_progress" | "completed" }[] }
        | { type: "answer.token"; runId; text }            // the final answer streaming
        | { type: "run.finished"; runId; status; error?; at }
        | { type: "canvas.locked" | "canvas.unlocked"; workflowId; runId }
      ```

## 4. Routes (`assistant/routes.ts`, mount at `/api/v1/assistant` in `src/routes.ts`)

All behind `authGuard`, `validate`, rate limits, owner checks.

- [ ] `GET /threads?cursor=` → the user's threads, newest first (title, workflow name, updated_at). History list.
- [ ] `POST /threads` → new empty thread (New chat). Cap: 200 threads per user; oldest beyond cap can be deleted.
- [ ] `GET /threads/:id` → messages + the active run (status, todos) if any. This is what makes "come back later"
      work.
- [ ] `PATCH /threads/:id` (title), `DELETE /threads/:id`.
- [ ] `POST /threads/:id/messages` `{ content, files?: fileId[], workflowId, modelId }` →
      validate model (`modelError`), workflow ownership, file ownership (files module), the daily budget, **one
      active run per user** (409 `BUSY` otherwise); save the user message; create `assistant_run`; start
      `ASSISTANT_RUN`; return `202 { runId }`.
- [ ] `POST /runs/:id/stop` → set `cancelled`, the workflow loop sees it between slices; also
      `terminate()` the instance after a grace period if needed (see `workflows/routes/runs.ts` cancel). Lock released.
- [ ] `GET /memory`, `PUT /memory` (user can read/clear what the assistant remembers).
- [ ] `POST /live-token` (relay token).
- [ ] Uploads: reuse the existing files upload route (`modules/files/routes/upload.ts`) — the panel uploads first,
      then sends ids. Only images and text-like files (pdf, txt, md, csv, json) for the assistant; size limits from
      the files module.

## Acceptance

- [ ] Send a message, close the tab, wait, reopen the builder: the thread shows the finished answer and the canvas
      shows the changes.
- [ ] Reopen while running: the panel shows the live todo list (from `GET /threads/:id` then the socket).
- [ ] A second message while a run is active → 409 with a friendly message.
- [ ] Stop → run ends `cancelled` within one slice; canvas unlocked.
- [ ] Killing the instance (simulate an error in a slice) → `failed`, lock released, user sees the error.
