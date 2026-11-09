# Bots and chat

## Bots

A bot belongs to one user. Its settings (`bot` table, edited on `/dashboard/avatar`):

| Setting | Effect |
|---|---|
| Name, avatar (shape, colour, expression) | Identity in the UI and the prompt |
| **Role** | `assistant`, `advisor`, `writing`, `research`, `coding` or `custom` (with your own title). Each role is a *domain* (`modules/agent/domains`): a playbook in the system prompt, default capabilities, and recommended skills and apps |
| Model and reasoning level | Any model in `modules/agent/models.json` (OpenRouter ids, free and paid); remembered per bot |
| Sub-agents | Whether the bot may spawn groups of sub-agents, and the largest group (1–20) |
| Parallel tools | How many tool calls may run at once (1–10) |
| Skills, MCP servers, apps | Which installed skills, connected MCP servers and Composio apps this bot may use (per app: which account, and whether it may write) |

## The chat run

Sending a message (`POST /api/v1/chat/threads/:id/messages`) never runs the agent inside the request:

1. The route checks ownership, the model, the daily quota and that the thread has no run in progress, then creates a
   `ChatRunWorkflow` instance whose id is the message id (a resend of the same message is a no-op) and answers `202`.
2. The workflow saves the user message and builds the agent (`modules/agent/agent.ts`): model, system prompt
   (`src/prompts/chat-system.ts`), tools for this bot and mode, and middleware (parallel tools, tool errors and retries,
   summarisation, todo guard, plan guard, view-image).
3. It runs in **slices**. Each slice is a durable step that drives the agent for up to `RUN_SLICE_STEPS` steps (60),
   saving finished message parts as it goes and checkpointing the agent state to Postgres. The next slice resumes from
   the checkpoint. A run may take up to `MAX_RUN_SLICES` slices.
4. When the agent needs the user (an approval card, `ask_user`) the workflow waits for an event, up to 7 days, at no
   cost. When it wants to come back later (`wait_for`), it sleeps. Model provider failures (overloaded, rate-limited)
   retry with backoff (5 s doubling to 5 min, 10 tries).
5. Every token, reasoning chunk and tool event is published to the thread's `ChatRelay` Durable Object, which numbers it,
   stores it in `chat_event` and broadcasts it to the open sockets.

### Streaming and reconnecting

The browser connects to `GET /chat/threads/:id/ws` with a short-lived token and its last seen `seq`. The relay replays
anything missed; if the client is too far behind it is told to reload history over HTTP. The input box queues messages
while offline and sends them when the connection is back. Stop (`POST /chat/runs/:runId/stop`) is checked between
steps.

### Commands

| Command | Effect |
|---|---|
| `/deep-research <question>` | Hands the question to Tavily's research agent once (mini or pro), saves the report as a file, and shows it with sources. A repeated or retried request resumes the same paid job (`research_task`) |
| `/compact` | Summarises the conversation now to free context, then confirms in one or two sentences |

### Context and summarisation

The context meter shows how full the model's window is. Summarisation starts at 80% of the window, keeping recent
messages (Deep Agents' summariser with this project's threshold).

## Permission modes

Picked per thread in the prompt bar; stored on `chat_thread.mode`.

| Mode | What the bot may do |
|---|---|
| **Ask** (default) | Anything, but each action that changes something shows an Approve / Reject card first |
| **Plan** | Read-only tools only (an allow-list in `agent/modes.ts`). It replies with a numbered plan; when it needs to act it calls `request_mode_switch`, which shows a button that switches the mode and resumes |
| **Allow all** | Acts without asking. Turning on the computer and deleting a sandbox still always ask |

Approvals are LangChain human-in-the-loop interrupts; the run waits durably until the user answers.

## Memory

| Store | Scope | Tool |
|---|---|---|
| `bot_memory` | One bot, across all its chats | `update_memory` |
| `user_preferences` | All of the user's bots (name, language, tone, formats) | `update_user_preferences` |

Both are in every system prompt and editable by the user.

## Quotas

Before a run starts: runs per day (`MAX_RUNS_PER_USER`, counted from the user's own messages, so a crashed run still
counts) and tokens per day (`MAX_DAILY_TOKENS_PER_USER`). Free models are not counted (OpenRouter limits them itself).
See [Limits](../reference/limits.md).

## Key files

| Path | Purpose |
|---|---|
| `apps/backend/src/modules/chat/routes/` | threads, messages, history, realtime token, resume, stop |
| `apps/backend/src/modules/chat/run/` | `workflow.ts` (the run), `slice.ts`, `sink.ts`, `recorder.ts`, `provider-error.ts` |
| `apps/backend/src/modules/chat/relay/` | The per-thread relay Durable Object |
| `apps/backend/src/modules/agent/` | Agent build, modes, approvals, middleware, tools |
| `apps/web/src/features/chat/` | Chat view, `use-chat` hook (socket, outbox, hydration), prompt bar, approval cards |
