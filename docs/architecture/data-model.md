# Data model

Postgres (Neon) through Drizzle ORM. Schema: `apps/backend/src/db/schema/*.ts`. Migrations: `apps/backend/drizzle/`
(generated, applied in order; see [Development guide](../guides/development.md#database-migrations)).

Every user-owned table has a `user_id` (or reaches the user through its bot) with `ON DELETE CASCADE`, so deleting a
user removes their data. Usage rows are the exception by design: they outlive deleted chats so daily caps cannot be
reset by deleting things.

## Entity map

```
user ─┬─ session, account, verification          (Better Auth)
      ├─ bot_group ── bot_group_member ── bot      (group chats; chat_thread.group_id)
      ├─ admin_audit                                (what the admin bot changed)
      ├─ bot ─┬─ chat_thread ─┬─ chat_message
      │       │               ├─ chat_event        (live stream log, pruned after 7 days)
      │       │               └─ research_task
      │       ├─ bot_memory
      │       ├─ bot_skill ──────── user_skill
      │       ├─ bot_mcp_server ─── user_mcp_server
      │       ├─ bot_composio_app                  (which connected apps the bot may use)
      │       ├─ bot_sandbox
      │       ├─ bot_workflow ───── workflow        (workflows shared with / made by the bot)
      │       └─ scheduled_task
      ├─ user_preferences
      ├─ user_secret
      ├─ chat_file                                  (R2 object metadata)
      ├─ agent_usage                                (tokens per run: the daily budget)
      └─ workflow ─┬─ workflow_run ── workflow_run_step
                   └─ (composio_trigger_id → a Composio trigger instance)

shared: composio_toolkit (app catalog), composio_event (dedupe), checkpoints*, rate_limit
```

## Tables

### Accounts (`auth.ts`)

| Table | Purpose |
|---|---|
| `user` | Better Auth users (`email_verified`, `composio_session_id`, …) |
| `session`, `account`, `verification` | Better Auth sessions, OAuth accounts, email verification and reset tokens |
| `rate_limit` | Better Auth's database-backed rate limiter |

### Bots and chat

| Table | Purpose |
|---|---|
| `bot` | A bot: name, avatar, role (and custom title), model and reasoning level, sub-agent and parallel-tool settings; `kind` normal / admin (one admin per user, a partial unique index) |
| `bot_group`, `bot_group_member` | Group chats: name, lead bot, shared notes (`memory`), members |
| `admin_audit` | Each change the admin bot made (action, bot, details) |
| `chat_thread` | A conversation with one bot, or a group's (`group_id`; `bot_id` is then the lead); `mode` (`ask` / `plan` / `allow_all`), `context_tokens` for the context meter |
| `chat_message` | User and assistant messages; `parts` is a JSON list (text, reasoning, tool calls, files); `author_bot_id` (group chats); ordered by a per-thread `seq` computed inside the insert |
| `chat_event` | Every live event of a thread, numbered gap-free by the relay; clients replay from their last `seq` |
| `checkpoints`, `checkpoint_blobs`, `checkpoint_writes` | LangGraph checkpoints: the agent's state between slices of a run (keyed by thread, or `<thread>:<bot>` in a group chat) |
| `agent_usage` | Tokens per run and model; the daily budget sums these. `thread_id` is set null (not deleted) when a chat goes away |
| `research_task` | Paid `/deep-research` jobs keyed by a hash of the request, so a retry resumes instead of paying twice |
| `bot_memory` | One bot's long-term notes (only that bot reads or writes them) |
| `user_preferences` | Preferences shared by all of the user's bots |
| `memory_event` | Automatic memory updates (before/after) for Undo; kept 30 days |

### Files and integrations

| Table | Purpose |
|---|---|
| `chat_file` | A stored file (upload, generated image, shared from the computer); the bytes are in R2 at `storage_key` |
| `user_skill`, `bot_skill` | Installed skills (a pinned snapshot in R2) and which bots use them |
| `user_mcp_server`, `bot_mcp_server` | Connected MCP servers (secrets encrypted) and which bots may use them |
| `bot_sandbox` | A bot's code sandbox and its daily running time |

### Connected apps (`composio.ts`)

| Table | Purpose |
|---|---|
| `composio_toolkit` | The app catalog, copied daily from Composio (name, logo, categories, actions and events counts, rank) |
| `bot_composio_app` | Which apps a bot may use, optionally pinned to one connected account, and whether it may write |
| `composio_event` | Ids of app events already received (kept 7 days) so a redelivery starts nothing |

The user's connections themselves live at Composio (keyed by the user id); they are listed live, not copied.

### Workflows (`workflow.ts`, `bot-workflow.ts`)

| Table | Purpose |
|---|---|
| `workflow` | `graph` (the draft being edited) and `published_graph` (what runs); `status` draft/active/paused; `trigger_kind`, `next_run_at` (schedules), `webhook_token_hash` (only the hash), `composio_trigger_id` (app events), `paused_reason` (why the system turned it off) |
| `workflow_run` | One run: trigger, status, the graph snapshot it runs, input, error, failed block |
| `workflow_run_step` | One row per block per run (rewritten on every attempt): status, attempt, input, output, error |
| `bot_workflow` | Workflows a bot may see and run; `created_by_bot` counts toward its daily creation cap |
| `webhook_request` | Calls to webhook workflows (status, reason, hashed IP, run); kept 7 days |

### Secrets and tasks

| Table | Purpose |
|---|---|
| `user_secret` | Encrypted secrets for workflows (`{{secrets.NAME}}`); only the last 4 characters are ever shown |
| `scheduled_task` | A bot's scheduled task: prompt, schedule (JSON), status, `next_run_at`, `last_error` |

## JSON columns

| Column | Shape defined in |
|---|---|
| `workflow.graph`, `published_graph`, `workflow_run.graph` | `modules/workflows/graph/schema.ts` (`graphSchema`; the draft may hold `pins`, a test run's copy `stopAfter`) |
| `scheduled_task.schedule`, schedule triggers | `modules/schedules/config.ts` (`scheduleConfig`) |
| `chat_message.parts` | `modules/agent/parts.ts` |

Graphs saved before a new setting existed are parsed with the schema's defaults whenever they are read, published or
run, so old rows never need a data migration.
