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
| Manual | You press Run (or a bot runs it). Optional **form**: typed fields (text, number, yes/no, list; required or not) asked before each run and checked on the server | `{{trigger.inputs.<key>}}` |
| Schedule | Its time comes: once, daily, weekly (chosen days), monthly (31 = last day) or every N minutes/hours/days/weeks (≥ 5 min), at a wall-clock time in an IANA time zone | `{{trigger.scheduledAt}}` |
| Webhook | Another service POSTs JSON to the workflow's secret URL | `{{trigger.body.x}}`, `{{trigger.headers}}` |
| App event | Something happens in a connected app (any Composio event: a new email, a Slack message, a new row…) | `{{trigger.data.x}}`, `{{trigger.event}}` |

### Actions

| Block | Does | Retries / on error |
|---|---|---|
| App action | Runs one Composio action of a connected app; inputs drawn from the action's schema, with file pickers for file inputs | yes |
| HTTP request | Calls any public API (GET/POST/PUT/PATCH/DELETE, query parameters, headers, JSON/text/form body, 1–30 s timeout) with SSRF protection. **Sign in** presets take the token from Secrets: Bearer, Basic, or an API-key header (stripped on a redirect to another site). Output: status, headers, body | yes |
| Ask a bot | One of your bots writes, summarises, classifies or decides; answers as text or JSON | yes |
| Decide (Jev) | Typed questions (yes/no, pick one, score) answered with calibrated probabilities ([details](decision-block.md)) | yes |

### Logic

| Block | Does |
|---|---|
| If / else | Takes the true or false path. Typed conditions: text (equals, contains, starts/ends with, regex…, case-sensitive switch), numbers, dates (before/after/same day), length, empty / not empty, true / false; all or any |
| Switch | Paths checked in order, one output each; the first that matches is taken, else **otherwise** |
| Filter | Continues only when the conditions hold |
| Delay | Waits (durable sleep, up to 7 days in total per run) |
| Set fields | Shapes data for later steps |
| For each | Runs the blocks after its **each item** output once per item (≤ 100 items, ≤ 300 block runs, one per workflow). Blocks after its **done** output run once at the end and read `{{steps.<loop>.output.results}}` (each item's result: the last repeated block that ran) |
| Merge | Brings 2–5 values together: append into one list, combine objects, match two lists by a key field, or take the first that has a value (the path that ran) |
| List tools | One operation on a list: split out a list field, pick a field, sum / average / min / max, count, sort, group by, remove duplicates, first N |
| Formatter | Text, number, date and list formatting without code |
| Ask me first | Waits for your Approve / Decline in the builder (1–168 h); declined skips the path after it |

## The builder (`/workflows/[id]`)

- **Left:** the block library (built-in blocks and every app), searchable; click or drag to add. Hides with `[`.
- **Canvas:** React Flow. Drag from a dot to connect (the grab area stays ~20 px at any zoom). Cycles are refused as you
  draw, with the same rules the server applies on save.
- **Right:** the settings panel, shown or hidden with its own button or `]` (selecting a block never opens it). Tabs:
  **Setup** (what the block does), **Data** (every field earlier blocks give, with type and meaning; click to copy a
  reference), **Output** (status, input, output, errors, an AI step's tool calls, approval buttons), **Options**
  (retries and what happens on failure). On a screen ≥ 1280 px the **widen** button shows Input · Settings · Output
  side by side (n8n's node view).
- **Pin data:** in Output, **Pin this output** keeps a block's result as sample data: test runs use it instead of
  running the block (no app is called again). Pins are saved with the draft (`graph.pins`, ≤ 256 KB) and dropped on
  publish; live runs never read them.
- **Test this step:** a test run that stops after the selected block; blocks before it reuse their output from the run
  shown (pins win), so only what is missing runs.
- **Test runs of webhook and app-event workflows** ask for the sample body; **Use the last real request/event** fills
  it from the workflow's latest real run.
- **Top bar:** name, on/off state, save state, issues to fix, keyboard shortcuts (`Ctrl/⌘ K`), sharing with bots, runs
  history, Run, Turn on / Publish changes, webhook URL rotation.
- **Mapping data:** every text field shows references as pills ("Gmail · subject"). Add one by dragging a field from
  the Data tab, with the **+** button (a searchable list of every earlier block's fields), or by typing `{{path}}`.
  The stored value is still the `{{…}}` template, so runs and old workflows are unchanged.
- **Placeholders** show an input's default, else the first example that fits its type, else a format hint.
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

## Webhook settings

Who may call: anyone with the URL (default), or additionally a **secret header** or an **HMAC-SHA256 signature** of
the raw body (the secret comes from the vault; Stripe/GitHub style, configurable header and prefix), plus an optional
**IP allowlist** (addresses or IPv4 ranges). Every call is logged for 7 days (status, reason, hashed IP) and shown under
"Latest calls". Limits: 100 requests/min per IP, 60 runs/min per workflow, 256 KB JSON.

## Approvals

"Ask me first" blocks wait for an answer on the **Approvals** page (`/dashboard/approvals`), in the run banner, or in
the block's Last run tab. When a bot started the run, `run_workflow` tells the bot it is waiting, and the bot tells you.
With no answer in time the block fails or counts as declined (a setting).

## Bots and workflows

- Share a workflow with bots from the builder's **Bots** dialog (`bot_workflow`), or let a bot create its own.
- **Ownership:** a bot may change, turn on or off, or delete only workflows it created (`delete_workflow` asks first in
  Ask mode). Shared workflows are read-and-run only.
- **Missing apps:** `create_workflow` and `turn_on_workflow` report apps the user has not connected; the bot calls
  `request_app_connections`, which shows a card in the chat with each app's logo and a Connect button, and waits.
- Bots see only shared workflows and their own; creating is capped per bot per day.
- Chains are at most two deep: a bot can run a workflow, but the workflow's AI step has no workflow tools.

## API

See [API reference](../reference/api.md#workflows). Edge cases and how each is handled: [Workflow edge cases](../reference/workflow-edge-cases.md).
