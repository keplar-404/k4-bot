# K4 workflow-builder assistant: current codebase audit

All paths are relative to `apps/backend/src/` unless they start with `apps/` or `docs/`. Line numbers come from the working tree on branch `development` (2026-11-11), which has uncommitted changes.

## Q1. Which tools does the assistant expose, and with what schemas, limits, confirmations and known weaknesses?

### Takeaway
The assistant is a LangChain `createAgent` with 20 custom tools plus `write_todos`. It covers draft editing, app discovery, one blocking test run, turning the workflow on or off, sharing with bots, JSON import/export and memory. It cannot inspect run history or step outputs, and it cannot read pins, secrets, webhook URLs or schedule previews. The fixes after the free-model run were schema and search changes: a fixed enum of block kinds, a word-ranked action search, a fallback list when the search finds nothing, and settings that may be sent as a JSON string.

### Cited Findings
**Harness**
- The agent is `createAgent` with this middleware, in order: tool-errors, tool-retry (read-only tools only), `todoListMiddleware`, todo-guard, `toolCallLimitMiddleware({runLimit: 120, exitBehavior:"continue"})`, and piiMiddleware for credit cards and API keys. It uses the Neon checkpointer. — [modules/assistant/agent.ts:42-67](modules/assistant/agent.ts), [modules/assistant/limits.ts:6](modules/assistant/limits.ts)
- The read-only tools that get retries are get_workflow, find_apps, find_app_actions, get_action_details, find_app_events, list_bots and export_workflow_json. — [modules/assistant/agent.ts:22](modules/assistant/agent.ts)
- The system prompt holds the rules, BLOCKS_HELP and TEMPLATES_HELP, the user's memory, today's date, and `describeWorkflow(w,true)` capped at 12,000 chars. — [modules/assistant/agent.ts:60-64](modules/assistant/agent.ts), [prompts/assistant.ts:7-25](prompts/assistant.ts)
- The prompt says: plan with write_todos (3–8 steps), edit one block at a time, never invent slugs, call request_app_connections before testing, never test steps that send, post or pay unless asked, write secrets only as `{{secrets.NAME}}`, and treat app or run text as data. — [prompts/assistant.ts:9-19](prompts/assistant.ts)
- A message is capped at 8,000 chars and 5 files. Text files are inlined up to 30,000 chars each, and images are sent only to vision models. — [modules/assistant/limits.ts:3-21](modules/assistant/limits.ts), [modules/assistant/agent.ts:27,74-94](modules/assistant/agent.ts)
- Durability:
  - A run is a Cloudflare Workflow made of slices. Each slice has a 20-minute wall clock and a recursion limit of `RUN_SLICE_STEPS`. — [modules/assistant/slice.ts:14,58](modules/assistant/slice.ts)
  - A run gets at most 40 slices. Each confirmation waits up to 7 days through `waitForEvent`. — [modules/assistant/workflow.ts:13,82](modules/assistant/workflow.ts)
  - Stop is detected by polling every 1.5 s. — [modules/assistant/slice.ts:23,69-75](modules/assistant/slice.ts)
  - An edit lock is held for the whole run. — [modules/assistant/workflow.ts:37,105](modules/assistant/workflow.ts)
- The user sees only the todos, the canvas and the final answer. Tool calls are never streamed. — [modules/assistant/live.ts:8-17](modules/assistant/live.ts)
- Only one assistant run per user can be active at a time, and runs are subject to the daily token budget. — [modules/assistant/routes.ts:83-88](modules/assistant/routes.ts)
- Missing compared with the bot chat: there is no summarize middleware and no parallel-tools limit (compare [modules/agent/middleware/stack.ts:40-44](modules/agent/middleware/stack.ts)). The history is the checkpointer thread `assistant:<threadId>`, which keeps growing because nothing compacts it. — [modules/assistant/slice.ts:58](modules/assistant/slice.ts)

**Tools** (all in [modules/assistant/tools.ts](modules/assistant/tools.ts))

| Tool | Schema / behaviour | Lines |
|---|---|---|
| get_workflow | `{}` → `describeWorkflow(w,true)`: name, status, trigger, issues (up to 8 `publishIssues`), manual-form inputs, nodes and edges with positions removed. Pins are left out, because only nodes and edges are returned, so the model cannot see pinned data. | 111-115; common.ts:15-34 |
| set_workflow | `{nodes[1..50], edges[..100]}` replaces the whole graph | 117-129 |
| add_block | `{id (regex ≤40), kind: enum(KINDS), label, config (object or JSON string), retry, onError, after?, branch?}` | 66-79, 131-149 |
| update_block | `{id, label?, config? (shallow merge), retry?, onError?}` | 151-178 |
| remove_block | `{id}` removes the block and its edges | 180-188 |
| connect_blocks | `{source, target, branch?, remove?}` | 190-203 |
| rename_workflow | `{name ≤80, description ≤500}` | 205-212 |
| find_apps | `{query ≤80}` → top 10 catalog entries (slug, name, number of actions and events, noLogin) | 214-220 |
| find_app_actions | `{app, query}` → `rankActions` top 15. If nothing matches, it returns the first 25 actions with a note | 222-239 |
| get_action_details | `{action}` → input and output schema, cut at 8,000 chars | 241-247 |
| find_app_events | `{app}` → first 30 trigger types, 6,000 chars | 249-255 |
| request_app_connections | `{}` → `missingApps`. If any are missing, it calls `interrupt` and shows a Connect card | 257-270 |
| test_workflow | `{until?, inputs?}` → `startRun(trigger:"test")` + `waitForRun` (45 s). At most 10 per turn | 31-32, 272-299 |
| turn_on_workflow | `{}` → interrupt to confirm, then `publishWorkflow`. The webhook token is not returned | 301-313 |
| turn_off_workflow | `{}` → `pauseWorkflow`, with no confirmation | 315-322 |
| list_bots | `{}` → the user's bots (id, name, role) | 324-327 |
| share_with_bots | `{botIds ≤20}` → interrupt to confirm, then `setSharedBots` | 329-341 |
| export_workflow_json | `{}` → `toPortable`, 12,000 chars | 343-347 |
| import_workflow_json | `{document}` → `importDocument` replaces the draft | 349-358 |
| save_memory | `{content ≤8000}` replaces the memory. One blob per user | 360-371; store.ts:7,122-127 |

- Every edit goes through `edit()`: load → change → `buildGraph` (zod and structure validation) → `saveDraft` with optimistic `updatedAt` → live `draft.updated` → returns `{saved, issues}`. — [modules/assistant/tools.ts:97-109](modules/assistant/tools.ts)
- `buildGraph` keeps existing positions and places a new block 160px below its source, spreading siblings 280px apart. It keeps pins and returns the zod error as text (max 1,500 chars) or the first structure issue. — [modules/assistant/graph-edit.ts:16-43](modules/assistant/graph-edit.ts)
- A check file confirms that the tool schemas convert to JSON Schema, which guards against transforms. — [modules/assistant/tools.check.ts:5-10](modules/assistant/tools.check.ts)

**Fixes from the free-model run** (wasted search calls and invented block kinds)
- Block `kind` is now a fixed `z.enum` built from `nodeSchema`, so "a model cannot invent 'app_action' or 'trigger'". — [modules/assistant/tools.ts:34-35,68](modules/assistant/tools.ts)
- The action search is now ranked by matching words, with a plural strip and double weight for words in the name, because "matching the whole phrase found nothing". — [modules/assistant/search.ts:9-28](modules/assistant/search.ts), with tests built from real queries in [modules/assistant/search.check.ts:4-17](modules/assistant/search.check.ts)
- When nothing matches, the tool lists the app's first 25 actions "so the model picks from real ones instead of searching again". — [modules/assistant/tools.ts:225-231](modules/assistant/tools.ts)
- `config` also accepts a JSON string ("some models send '{}' as a string") and is parsed by `asSettings`. — [modules/assistant/tools.ts:37-56](modules/assistant/tools.ts)

**Weaknesses found in the code**
- **Bug: test inputs for webhook and app triggers.** For a non-manual trigger, `test_workflow` wraps the inputs as `{inputs}`. The HTTP route instead builds `{body,headers,receivedAt}` for a webhook, `{scheduledAt}` for a schedule, and `{event,data,eventId,receivedAt}` for an app trigger. As a result, assistant tests of webhook and app-trigger workflows see a trigger payload with the wrong shape. — [modules/assistant/tools.ts:277](modules/assistant/tools.ts) vs [modules/workflows/routes/runs.ts:30-41](modules/workflows/routes/runs.ts)
- `test_workflow` has no `pins` parameter, although the route accepts extra pins. It also cannot pin an output after a test. — [modules/workflows/routes/runs.ts:24,54](modules/workflows/routes/runs.ts)
- `waitForRun` returns only the status, the error, `failedNodeId`, and either the Return output or the last 3 step outputs (8,000 chars). It does not return per-step errors, inputs or the full step list. After 45 s it says "check later with workflow_run_status", but the assistant does not have that tool. — [modules/agent/workflows/wait.ts:5-35](modules/agent/workflows/wait.ts)
- `update_block` merges config only at the top level, so a nested `arguments` object is replaced as a whole. — [modules/assistant/tools.ts:161](modules/assistant/tools.ts)
- `turn_off_workflow` does not ask for confirmation, while turn_on and share do. — [modules/assistant/tools.ts:301-341](modules/assistant/tools.ts)
- The block help is plain prompt text (BLOCKS_HELP/TEMPLATES_HELP in `prompts/workflow-tools.ts`). There is no tool that returns the config schema of a single kind.

### Inferences
- The free-model fixes reduce wasted searches through constraints in the schema and a fallback list, not through prompt text. The same approach (enums and an always-useful fallback) should be used for new tools.
- Because there is no summarization, long multi-turn chats may overflow the context of small models.

### Gaps
- I did not read the full text of BLOCKS_HELP/TEMPLATES_HELP (`prompts/workflow-tools.ts`), so I cannot say how completely it documents each config.
- I found no record (no log or doc) of the exact free-model run. The fixes are inferred from code comments.

## Q2. What is the workflow graph model, and what can the engine and run system do?

### Takeaway
A graph is made of up to LIMITS.nodes typed blocks (21 kinds) plus edges, optional `pins` (draft-only sample outputs, 256 KB in all) and a transient `stopAfter`. The engine runs on Cloudflare Workflows, with templates like `{{steps.X.output...}}`, `{{trigger...}}`, `{{loop.item}}` and `{{secrets.NAME}}`, approvals, delays up to 7 days, schedules and webhooks.

### Cited Findings
- Kinds:
  - Triggers: `trigger.manual|schedule|webhook|app`.
  - Actions: `action.app|http|code`.
  - Logic: `logic.if|filter|delay|set|return|switch|format|merge|list|loop|approval`.
  - AI: `ai.bot|ai.decide`.
  - Source: [modules/workflows/graph/schema.ts:39-60](modules/workflows/graph/schema.ts)
- `pins` holds sample outputs per block. Test runs use them instead of running those blocks, and publishing drops them. `stopAfter` limits a test to one block and the blocks it needs. `liveGraph` removes both. — [modules/workflows/graph/schema.ts:75-93](modules/workflows/graph/schema.ts)
- Template context is `trigger`, `steps[id].{output,error}`, `run.{id,startedAt}`, `loop.{item,index,count}` and `secrets` (action blocks only). Limits: at most 50 references, path depth 10, 100 KB, and prototype keys blocked. — [modules/workflows/engine/template.ts:3-31](modules/workflows/engine/template.ts)
- `publishIssues` checks for a missing trigger, fewer than 2 nodes, blocks not connected to the trigger, and total delay over 7 days. `structureIssues` and `topoOrder` check for cycles and similar problems, and `loopIssues` checks For-each rules. — [modules/workflows/graph/validate.ts:20-46](modules/workflows/graph/validate.ts), [modules/workflows/graph/structure.ts:9,32](modules/workflows/graph/structure.ts), [modules/workflows/graph/loop-rules.ts:5-57](modules/workflows/graph/loop-rules.ts)
- Webhook trigger config options: auth `none|header|hmac`, `secretName` (a vault name), header names, signature prefix, and an IP allowlist. — [modules/workflows/graph/webhook-config.ts:15-23](modules/workflows/graph/webhook-config.ts)
- `nextRunAt(trigger)` computes the next time a schedule is due. The token is a 256-bit value; only its hash is stored, and it is shown once. — [modules/workflows/graph/triggers.ts:12-32](modules/workflows/graph/triggers.ts)
- The schedule cron runs every minute and does not make up late runs. A "once" schedule pauses itself after it runs. If a run cannot start, a failed "Skipped:" row is written. — [modules/workflows/engine/schedule.ts:19-82](modules/workflows/engine/schedule.ts)
- Stuck runs: a run is failed after 9 days running or 10 minutes queued. — [modules/workflows/engine/schedule.ts:85-95](modules/workflows/engine/schedule.ts)
- Run triggers are `manual|test|schedule|webhook|bot|app`. A run row stores the graph and the input, and the steps are stored in `workflowRunStep`. — [modules/workflows/store/runs.ts:31-51,103-116](modules/workflows/store/runs.ts)
- Secrets in step outputs are redacted (`redact`, `secretNamesIn`). — [modules/workflows/engine/redact.ts:6,19](modules/workflows/engine/redact.ts)

### Inferences
- The engine already supports n8n-style pin data and "test this step". The assistant exposes `until` but has no way to work with pins.

### Gaps
- I did not read the config schema of each block (blocks.ts, event-ai-blocks.ts), walk.ts, run-node.ts or execute-block.ts in detail. The per-kind config fields are not listed here.

## Q3. Which engine and store functions exist but are not exposed as assistant tools?

### Takeaway
Many ready-made, user-scoped functions back builder routes that the assistant cannot call. These include run lists and run details with steps, cancelling a run, the approvals list and approval answers, the webhook token, the hook log, the secrets list and secret usage, the schedule preview, connections, and the per-block data picker (on the web side only).

### Cited Findings
| Function | What it gives | Location | Exposed to assistant? |
|---|---|---|---|
| `listRuns(db,userId,workflowId,30)` | latest runs: status, error, failedNodeId, times | store/runs.ts:83-100; route routes/index.ts:27 | No |
| `getRun(db,userId,runId)` | the run with all steps (input, output, error, status) | store/runs.ts:103-116; route routes/index.ts:21 | Only indirectly, through waitForRun's summary |
| `cancelRunRow` + `WORKFLOW_RUN.terminate` | cancels a run | store/run-control.ts:24-36; routes/runs.ts:82-107 | No |
| `waitingApprovals` + POST `/runs/:runId/steps/:nodeId/answer` `{approved,note}` | waiting approvals; answers one | store/approvals.ts:6-32; routes/answer.ts:16,28-40 | No (the user must answer) |
| `publishWorkflow` → `webhookToken` | the token is returned once | routes/lifecycle.ts:29-31 | The tool drops it on purpose (tools.ts:309) |
| `newWebhookToken` rotation | a new token | routes/lifecycle.ts:44-54 | No |
| `recentHooks(db,workflowId)` | recent webhook deliveries | store/hook-log.ts:25 | No |
| `listSecrets` | names, labels, app and hint only (never values) | secrets/store.ts:19-35 | No |
| `secretExists`, `workflowsUsingSecret`, `secretUsage` | checks whether a secret exists; where it is used | secrets/store.ts:37-40,80-95; secrets/usage.ts:33 | No |
| `nextRunAt` | the next schedule time | graph/triggers.ts:12-16 | No |
| `publishIssues`/`structureIssues`/`loopIssues` | validation | graph/validate.ts:25; structure.ts:32; loop-rules.ts:57 | Only through `edit()` and get_workflow |
| `listConnections`, `missingApps` | the user's connected accounts | composio/connections.ts:49; composio/requirements.ts:23 | Only `missingApps`, inside request_app_connections |
| `getTriggerType` | one event's config and payload schema | composio/triggers.ts:50 | No (find_app_events gives the list only) |
| `catalogCategories`, `isNoAuthToolkit` | catalog helpers | composio/catalog-query.ts:59,77 | No |
| `isRead(slug,toolkit,tags)` | classifies an action as read or write | composio/action-kind.ts:6 | No. It could enforce "don't test send/post" in code instead of only in the prompt |
| `inputProblems`, `fitArguments` | problems in an action's argument schema; fitting arguments to it | composio/schema-quality.ts:36; composio/arguments.ts:60 | No |
| `executeAction` | runs one app action | composio/execute.ts:43 | No (single-action probe) |
| `statsByWorkflow`, `runsOverTime` | success and failure counts | store/runs.ts:54-80 | No |
| `lockHolder` | the edit lock | store/lock.ts:14 | — |
| Web: `fieldsOf`, `useBlockSchema`, `shapeOf`, `schemaAt` | data-picker fields from an action's output schema or a sample/pin shape | apps/web/src/features/workflows/builder/template/block-fields.ts:19-91; shape.ts:7-62 | Web only. The backend has no equivalent for checking that a `{{steps.x.output.path}}` exists |

### Inferences
- No backend function validates references (does every `{{steps.ID...}}` point to an ancestor block, and does the path exist in that block's output schema or sample?). `shapeOf`/`schemaAt` from the web would need to be ported to build one.
- Undo is not implemented anywhere. `saveDraft` overwrites the draft, and no draft history table was seen in `store/workflows.ts:52-69`.

### Gaps
- I did not confirm whether the DB has a draft-version table; I only read the function list of store/workflows.ts.

## Q4. What does the bot chat agent have that the assistant could reuse?

### Takeaway
The bot uses Deep Agents with a richer middleware stack (summarize, hide-tools, parallel limit, group guard, vision routing) and its own workflow tools, including `workflow_run_status`, `run_workflow` and `list_my_workflows`. HITL is applied with `interruptOn` (askFirst) rather than an `interrupt` inside each tool.

### Cited Findings
- Bot middleware, outermost first: tool-errors, tool-retry, summarize (at 80% of the context window or on /compact), hide `task`, parallel-tools limit, todo-guard, group guard, extra, piiMiddleware ×2, screen, view, free-vision. — [modules/agent/middleware/stack.ts:19-64](modules/agent/middleware/stack.ts)
- Bot workflow tools:
  - list_my_workflows, get_workflow, workflow_run_status — [modules/agent/workflows/read.ts:14,27,45](modules/agent/workflows/read.ts)
  - create_workflow, update_workflow — [modules/agent/workflows/author.ts:39,63](modules/agent/workflows/author.ts)
  - turn_on_workflow, pause_workflow, run_workflow, delete_workflow — [modules/agent/workflows/run.ts:33,48,88,102](modules/agent/workflows/run.ts)
  - request_app_connections — [modules/agent/workflows/connect-apps.ts:24](modules/agent/workflows/connect-apps.ts)
- `workflow_run_status` returns the status, failedNodeId and every step's `{nodeId,status,error}`. — [modules/agent/workflows/read.ts:40-47](modules/agent/workflows/read.ts)
- Ask-mode HITL wraps turn_on_workflow, run_workflow and delete_workflow (and schedule tasks) with `askFirst`. — [modules/agent/account-tools.ts:13,35-39](modules/agent/account-tools.ts)
- The assistant already reuses `describeWorkflow`, `asText`, `waitForRun`, tool-errors, tool-retry and todo-guard. — [modules/assistant/agent.ts:9-14](modules/assistant/agent.ts), [modules/assistant/tools.ts:8-9](modules/assistant/tools.ts)
- The design doc deferred sub-agents, filesystem, computer and web search for v1 ("add later"). — [docs/features/workflow-assistant/03-assistant-agent-and-tools.md:26](docs/features/workflow-assistant/03-assistant-agent-and-tools.md)
- The design doc planned a `list_connected_apps` tool. Only `request_app_connections` was built. — [docs/features/workflow-assistant/03-assistant-agent-and-tools.md:68](docs/features/workflow-assistant/03-assistant-agent-and-tools.md) vs [modules/assistant/tools.ts:373-394](modules/assistant/tools.ts)

### Inferences
- The assistant could reuse these directly: `createSummarizeMiddleware` (it needs a backend argument and would need adapting), `createParallelToolsMiddleware`, and the step mapping of `workflow_run_status`.

### Gaps
- I did not read `summarize.ts` to see whether it can run without a Deep Agents backend.

## Q5. Recommended tool list (grouped, mapped to existing functions)

### Takeaway
Most of the missing capabilities can be built as thin wrappers around functions that already exist. The highest-value additions are reading runs and steps, pinning data, listing secret names, listing reference fields and validating references.

### Cited Findings (each mapping is to an existing function cited above)
**Read / inspect**
- `get_workflow` (keep). Add a pins summary and `nextRunAt` for schedule triggers. → `describeWorkflow` (agent/workflows/common.ts:15), `nextRunAt` (graph/triggers.ts:12)
- `get_block_kinds` / `get_block_help(kind)`: config fields for one kind, so the full BLOCKS_HELP does not have to sit in the prompt. → nodeSchema options (graph/schema.ts:39) through `z.toJSONSchema` (already proven in tools.check.ts:8)
- `list_reference_fields(blockId)`: the paths a later block can use. → port of web `fieldsOf`/`shapeOf`/`schemaAt` (block-fields.ts:71, shape.ts:14,62) + `getTool().output` + pins + `ancestors` (loop-rules.ts:20)
- `validate_workflow`: publish, structure and loop issues, plus a new check for references and secret names. → `publishIssues`, `structureIssues`, `loopIssues`, `secretExists`

**Edit**
- Keep add, update, remove, connect and set. Add a `merge: "deep"` option to update_block (tools.ts:161).
- `undo_last_change`: snapshot `w.graph` before each `edit()` (tools.ts:99) into run-scoped memory.
- Layout: `buildGraph` already places blocks (graph-edit.ts:23-43). A `tidy_layout` tool would be new code, since no auto-layout function exists in the backend.

**Discover apps**
- Keep find_apps, find_app_actions, get_action_details and find_app_events. Add `get_event_details` → `getTriggerType` (composio/triggers.ts:50), and `list_connected_apps` → `listConnections` (composio/connections.ts:49).
- `list_secrets` (names, labels and app only) → `listSecrets` (secrets/store.ts:20).

**Test / debug**
- Fix `test_workflow` so it builds trigger input with the route's `triggerInput` (routes/runs.ts:31-41), and add `pins`.
- `list_runs` → `listRuns` (store/runs.ts:83).
- `get_run(runId, nodeId?)`: per-step status, error, and input/output (truncated, already redacted) → `getRun` (store/runs.ts:103).
- `pin_output(blockId, data | fromRunId)` / `clear_pin` → write `graph.pins` through `edit()`, which `buildGraph` already preserves (graph-edit.ts:38). Respect MAX_PINS_BYTES (schema.ts:75).
- `cancel_run` → `cancelRunRow` + terminate (run-control.ts:24-36).
- `list_waiting_approvals` (read only; answering stays with the user) → `waitingApprovals` (store/approvals.ts:6).
- `recent_webhook_calls` → `recentHooks` (store/hook-log.ts:25).
- Use `isRead` (composio/action-kind.ts:6) to refuse or confirm tests of steps that write.

**Lifecycle**
- Keep turn_on (confirm), turn_off, share and export/import.
- `get_webhook_setup`: the URL pattern `/:id/:token` (routes/hooks.ts:28) and the auth config. The token itself is shown only in the UI.
- `schedule_preview` → `nextRunAt` (triggers.ts:12).

**Memory**
- Keep `save_memory` (it is one 8,000-char blob, store.ts:7). Consider an append or patch call instead of a full replace.

### Inferences
- Run outputs that are returned to the model should keep the "data, not instructions" framing and `asText` caps, like the existing tools (agent/workflows/common.ts:37-40).

### Gaps
- Effort and token-cost estimates for each new tool were not researched.
