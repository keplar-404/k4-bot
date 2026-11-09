# Workflows

Zapier/n8n-style automations: a graph of blocks, edited on a canvas, published, and run durably on Cloudflare.

## Concepts

| Term | Meaning |
|---|---|
| Graph | Blocks (nodes) and connections (edges), JSON validated by `graphSchema` (`modules/workflows/graph/schema.ts`). Up to 50 blocks and 100 connections |
| Draft / published | `workflow.graph` is what you edit; turning on copies it to `published_graph`, which is what runs. Editing never changes a live workflow until you publish again |
| Status | `draft`, `active` (on), `paused` (off). `paused_reason` says why when the system turned it off |
| Run | One execution of a graph snapshot; one `workflow_run` row and one `workflow_run_step` row per block |
| References | `{{trigger.…}}`, `{{steps.<blockId>.output.…}}`, `{{loop.item}}`, `{{secrets.NAME}}`, filled in when the run reaches the block |

## Blocks

### Triggers (exactly one per workflow)

| Block | Starts a run when… | Data for later blocks |
|---|---|---|
| Manual | You press Run (or a bot runs it) | `{{trigger.inputs.x}}` |
| Schedule | Its time comes: once, daily, weekly (chosen days), monthly (31 = last day) or every N minutes/hours/days/weeks (≥ 5 min), at a wall-clock time in an IANA time zone | `{{trigger.scheduledAt}}` |
| Webhook | Another service POSTs JSON to the workflow's secret URL | `{{trigger.body.x}}`, `{{trigger.headers}}` |
| App event | Something happens in a connected app (any Composio event: a new email, a Slack message, a new row…) | `{{trigger.data.x}}`, `{{trigger.event}}` |

### Actions

| Block | Does | Retries / on error |
|---|---|---|
| App action | Runs one Composio action of a connected app; inputs drawn from the action's schema, with file pickers for file inputs | yes |
| HTTP request | Calls any public API (GET/POST/PUT/PATCH/DELETE, headers, JSON/text/form body, 1–30 s timeout) with SSRF protection | yes |
| Ask a bot | One of your bots writes, summarises, classifies or decides; answers as text or JSON | yes |

### Logic

| Block | Does |
|---|---|
| If / else | Takes the true or false path (conditions: equals, contains, greater/less than, exists, is true…, all or any) |
| Filter | Continues only when the conditions hold |
| Delay | Waits (durable sleep, up to 7 days in total per run) |
| Set fields | Shapes data for later steps |
| For each | Runs every block after it once per item of a list (≤ 100 items, ≤ 300 block runs, one per workflow) |
| Ask me first | Waits for your Approve / Decline in the builder (1–168 h); declined skips the path after it |

## The builder (`/workflows/[id]`)

- **Left:** the block library (built-in blocks and every app), searchable; click or drag to add. Hides with `[`.
- **Canvas:** React Flow. Drag from a dot to connect (the grab area stays ~20 px at any zoom). Cycles are refused as you
  draw, with the same rules the server applies on save.
- **Right:** the settings panel, shown or hidden with its own button or `]` (selecting a block never opens it). Tabs:
  **Setup** (what the block does), **Data** (every field earlier blocks give, with type and meaning; click to copy a
  reference), **Last run** (status, input, output, errors, an AI step's tool calls, approval buttons), **Options**
  (retries and what happens on failure).
- **Top bar:** name, on/off state, save state, issues to fix, keyboard shortcuts (`Ctrl/⌘ K`), sharing with bots, runs
  history, Run, Turn on / Publish changes, webhook URL rotation.
- **Autosave** about 1 s after each change, with conflict detection between tabs.
- **Live runs:** a WebSocket from the workflow's `WorkflowRunRelay` paints each block's state as it runs; a banner
  shows progress, Cancel, and Approve / Decline for "Ask me first".

## Running

### How a run starts (`engine/start.ts`)

Every trigger goes through `startRun`: re-validate the graph, check caps (500 runs/day, 5 at once, 30 per bot per
hour, 256 KB input), save the run, then create a `WorkflowRunner` instance.

| Trigger | Path |
|---|---|
| Run / test | `POST /workflows/:id/run` (`test` runs the draft, `live` the published copy) |
| Schedule | The per-minute cron claims due workflows (`engine/schedule.ts`); a "once" schedule turns the workflow off after it runs |
| Webhook | `POST /api/v1/hooks/:id/:token` |
| App event | `POST /api/v1/composio/events` → every active workflow listening on that trigger instance for that user |
| Bot | `run_workflow` |

### The engine (`engine/runner.ts`, `walk.ts`, `run-node.ts`)

- Blocks run in topological order. A block runs if at least one connection into it was taken (If branches, Filters).
- Each block is one durable `step.do`; retries follow the block's settings (`ctx.attempt`); errors a retry cannot fix
  fail at once. A block set to "continue on error" lets the run go on (later blocks can read its error).
- Delays are `step.sleep`; "Ask me first" is `step.waitForEvent`. Waiting costs nothing and survives deploys.
- For each runs its blocks after the rest of the graph, once per item, each pass with its own step names.
- Every step writes the database first, then publishes a live event. Cancel marks the run cancelled first, so a late
  block cannot bring it back.
- Outputs are capped at 64 KB (marked `truncated`); secrets are scrubbed from stored input, output and errors.

### App events

1. Pick an app (only apps with events are listed), an account, an event and its settings; the panel shows what the
   event sends.
2. Turning on creates the Composio trigger instance on your account (connect the app first).
3. Composio posts events to `/api/v1/composio/events`: signature and age checked, duplicates ignored, then runs start
   for matching workflows (per-workflow rate limit applies).
4. A workflow that acts on the app it listens to and runs 30 times in 5 minutes is turned off (likely a loop). An
   expired connection turns off the workflows that use it.

Local development needs event forwarding; see [Troubleshooting](../guides/troubleshooting.md#an-app-event-never-starts-my-workflow).

### Ask a bot

Uses the chosen bot's memory, web search, up to 10 knowledge files, and (if allowed) read-only access to the bot's
connected apps. It cannot send, change or delete anything, start workflows or ask for secrets. Values from earlier
steps are wrapped as data. 100 AI steps per user per day; 5-minute timeout. Output: `text` or `json`, plus `used` (the
tools it called).

## Bots and workflows

- Share a workflow with bots from the builder's **Bots** dialog (`bot_workflow`), or let a bot create its own.
- Bots see only shared workflows and their own; creating is capped per bot per day.
- Chains are at most two deep: a bot can run a workflow, but the workflow's AI step has no workflow tools.

## API

See [API reference](../reference/api.md#workflows). Edge cases and how each is handled: [Workflow edge cases](../reference/workflow-edge-cases.md).
