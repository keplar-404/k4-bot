# B — Share a workflow with a bot; the bot runs it

Prerequisite: the engine and `startRun` (`../workflows/03`, `06a`).

## 1. Workflow inputs (so a bot knows what to pass)

Extend the manual trigger in `modules/workflows/graph/schema.ts`:
```ts
kind: "trigger.manual",
config: z.object({
  inputs: z.array(z.object({
    key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,40}$/),
    type: z.enum(["text", "number", "boolean", "json"]).default("text"),
    description: text(200).default(""),
    required: z.boolean().default(true),
  })).max(15).default([]),
}).default({ inputs: [] }),
```
- Builder (`settings/trigger-settings.tsx` → a new `manual-inputs.tsx`): an "Inputs" editor (key, type, description, required). `data-references.tsx` adds `{{trigger.inputs.<key>}}` chips.
- The Run button (`../workflows/02` step 4) shows a small form from these inputs.
- `startRun` validates the inputs against this list (types, required, ≤256 KB). The engine's context gives `trigger.inputs`.

## 2. Sharing

Table `bot_workflow` (migration):
```
bot_id FK bot on delete cascade, workflow_id FK workflow on delete cascade,
require_approval boolean not null default true,
created_at, primary key (bot_id, workflow_id)
```
- Both must belong to the same user (check on write).
- UI, both directions:
  - Builder top bar → **Share with bots** (a popover with the user's bots: checkboxes plus an "Ask me before each run" switch).
  - Bot form → **Workflows** section (the same data).
- API:
  - `GET/PUT /workflows/:id/bots` (`[{botId, requireApproval}]`, max 20);
  - bot create/update accepts `workflowIds`.
- Bots can run **active** workflows with a manual trigger that are shared with them, **or that the bot created itself** (`03`; those are shared with it automatically); they run the published graph. Show this rule in the share popover. Draft or paused ones appear greyed out with the reason.

## 3. Bot tools (`modules/agent/workflows/`)

| Tool | Approval | Behaviour |
|---|---|---|
| `run_workflow({workflow, inputs})` | **Ask:** approval card, unless the share has `require_approval=false`. **Allow all:** none. **Plan:** hidden (`04`) | Calls `startRun({trigger: "bot", input: {inputs}, startedBy: {botId, threadId, depth}})`, then **waits up to 60 s**, polling `workflow_run` every 1 s. Finished → `{status, outputs}` (the last blocks' outputs, ≤8 KB, **secrets redacted**) plus the failed block and error. Still running → `{status: "running", runId}`. |
| `workflow_run_status({runId})` | no | For long runs: the status plus a step summary. User-scoped, and only runs started by this bot's user. |

- Prompt: list the shared workflows with their name, description and inputs (from the published graph) so the bot knows when to use them.
- Notify on finish (optional, nice): when a bot-started run finishes after the 60 s wait, `publishEvent(env, threadId, "workflow.run", {runId, status})`, like `AsyncTaskWorkflow` does with `async.task`, so the chat shows a card "Workflow X finished ✓".

## 4. Schema/DB changes
- `workflow_run.trigger` enum: add `"bot"` (and `"workflow"` for D). It is a text column with a TS enum, so no SQL enum migration is needed; check.
- `workflow_run`: add `started_by_bot_id text null`, `thread_id text null`, `depth integer not null default 0`.
- Run history UI: "Started by <bot name>" with a link to the chat.

## 5. Limits / safety
- Bot-started runs count toward the same caps (500/day, 5 concurrent).
- Add a per-bot cap: ≤30 bot runs per hour per bot (count query).
- Depth: the tool passes `depth = currentDepth + 1`; refuse when > 2 (relevant once D exists).
- The workflow runs as the workflow owner = the bot owner (the same user), so there is no privilege change.

## Done when
- Share "Send weekly report" (inputs: `week`) with a bot → in chat "send this week's report" → an approval card (if required) → the run happens → the bot reports success and the run shows "Started by <bot>".
- An unshared or paused workflow → the bot can't see or run it.
- A workflow with a 5-minute delay → the bot says it is running; the chat card appears when it finishes.
