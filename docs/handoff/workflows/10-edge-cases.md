# 10 — Edge cases: what happens, and how it is handled

Status (2026-11-08): **Handled** = in the code; **Tested** = covered by a check script or the end-to-end runs; **Open** =
known gap, with the reason.

Examples use Slack, Gmail and Supabase, but nothing here is app-specific: every app goes through the same three
paths — an **event** starts a run (`trigger.app`), an **action** runs (`action.app`), and the data between them is
mapped with `{{references}}`.

## 1. Where the app information comes from

- Apps, actions, inputs and outputs: Composio's API (`getRawComposioTools`, `getRawComposioToolBySlug`), the same data
  that generates https://docs.composio.dev/toolkits. Nothing is hand-written or guessed.
- Events: `composio.triggers.listTypes` / `getType`: each event's settings (`config`) and what it sends (`payload`).
- Read or write: Composio's own hints on each action (`readOnlyHint`, `createHint`, `updateHint`, `destructiveHint`).
  Unknown means "write".
- Many actions only describe their output as a generic `data` object. For those, the builder says so and points to the
  run viewer, where the real output of a test run is shown field by field.

## 2. Connecting two unrelated apps (Supabase → Slack, GitHub → Notion…)

Apps never talk to each other directly: a run carries data from one block to the next, and each field of the next
block says what it reads (`{{trigger.data.record.email}}`, `{{steps.supabase_x.output.data.rows.0.id}}`).

| Case | What happens | Status |
|---|---|---|
| A number, yes/no or list comes from text (every template produces text) | Converted to the type the next action declares before the call (`composio/arguments.ts`): `"5"`→5, `"true"`→true, `"a@b.com"`→`["a@b.com"]`, `"[1,2]"`→[1,2] | Handled, Tested |
| A value cannot be converted (`"many"` for a number) | Sent unchanged; Composio's error names the field; the block fails at once (no retry) | Handled, Tested (live: Composio answered "Input should be a valid integer … `max_results`") |
| A referenced field does not exist (wrong path, the app sent less) | It fills in as empty. Empty optional fields are dropped; an empty **required** field fails the block before the call: "Fill in: Channel." | Handled, Tested |
| One app sends a list, the next takes one item | A path with an index (`items.0.id`), or **For each**: the blocks after it run once per item (`{{loop.item}}`), one per workflow, at most 100 items and 300 block runs | Handled, Tested |
| Field names differ between apps | The user maps them field by field; "Data from earlier steps" lists each earlier block's fields with type and meaning | Handled |
| An app's output is huge | Stored output capped at 64 KB (marked `truncated`); a filled-in field capped at 100 KB | Handled, Tested |
| Data from an app contains `{{steps.…}}` text | Never resolved again: a filled-in value is data, not a template (n8n CVE-2026-27493) | Handled, Tested |

## 3. Events that start a workflow (Slack message, new email, new row…)

| Case | What happens | Status |
|---|---|---|
| The user has not connected the app | Turning on refuses with "Connect slack first" before anything is created at Composio | Handled, Tested |
| Several accounts of the same app | Turning on asks which account; the trigger is created on that exact account | Handled |
| The event is pushed vs polled | Shown in the picker: "Instant" (Slack, Notion, GitHub…) or "Checked every few minutes" (Gmail, Calendar: at least every 2 min on Composio's managed auth) | Handled |
| Gmail polling starts | The first poll sets a baseline: mail that arrived earlier never starts runs (Composio's documented behaviour) | Documented |
| Composio delivers the same event twice (at-least-once) | Event id stored for 7 days; a redelivery starts nothing | Handled, Tested |
| A forged or replayed request to `/api/v1/composio/events` | Signature (HMAC over id.timestamp.body) and a 5-minute timestamp window, checked by the SDK; refused with 401 | Handled, Tested |
| The secret is not configured | All events refused (503), never accepted unverified | Handled, Tested |
| An event for user A reaches a workflow of user B | Impossible: the workflow must match the trigger instance **and** the event's user | Handled, Tested |
| Two workflows listen to the same event, same account, same settings | Composio returns one shared instance; both workflows run; pausing one keeps the instance for the other | Handled |
| The workflow is paused or deleted | Its listener is stopped (deleted at Composio unless another active workflow shares it); late events start nothing | Handled, Tested |
| The event's settings change while it is on | Republishing creates the new listener and stops the old one | Handled |
| A workflow's own action causes the event it listens to (a bot posting in the Slack channel it watches) | 30 app-event runs in 5 minutes by a workflow that also acts on that app turns it off with the reason shown; the rate limits bound it until then | Handled |
| A burst of events (a busy channel) | Each workflow is rate limited separately; Composio's shared IPs are not limited per IP | Handled |
| Starting the runs fails (database down) | The event id is forgotten and 500 returned, so Composio retries | Handled |
| A cap is reached | 200 returned (no pointless retries); the run is not started and the log says why | Handled |
| The app account is disconnected or its token expires | `composio.connected_account.expired` (signed like every event) turns off each workflow that uses that app and account; the builder and the list say why | Handled, Tested |
| Local development | Composio cannot reach localhost: `composio dev triggers listen --forward http://127.0.0.1:8787/api/v1/composio/events` | Documented |

## 4. Actions

| Case | What happens | Status |
|---|---|---|
| The action belongs to another app than the block says | Refused before the call | Handled, Tested |
| Composio refuses `latest` versions for direct calls | The version is pinned when the action is picked | Handled |
| Rate limits (ours and the app's) | 30 actions/min per user; 429 and 5xx retry with the block's retry settings; other 4xx fail at once | Handled, Tested |
| A destructive action (delete) | Runs like any other in a workflow the user built and turned on; a **bot** needs approval in Ask mode | Handled |
| The input form | Required fields first, optional folded; full description ("More"), type, default and an example under each field; enums as choices | Handled |
| File inputs (attachments) | A file picker (Files page) or a `{{reference}}`; the file is uploaded to Composio when the block runs (presigned URL: the SDK cannot upload from Workers) | Handled (live upload not tried) |

## 5. The AI step ("Ask a bot")

| Case | What happens | Status |
|---|---|---|
| An email or message tries to give the bot orders | Every filled-in value is wrapped in `<data>…</data>`; the bot is told data is never instructions; a value cannot close the wrapper early | Handled, Tested (wrapping) |
| The bot is tricked anyway | It has **no tool that changes anything** (web search, and reading its apps only): the worst case is a bad text. Whether that text is sent is decided by the next block the user put there — a draft is safer than sending | Handled by design |
| A secret in the prompt | Refused when publishing: secrets only go to app and HTTP blocks, never to a model | Handled, Tested |
| JSON answer wrapped in a code fence or malformed | Fence removed; invalid JSON fails the block with a clear message | Handled |
| The bot was deleted | The block fails with "That bot no longer exists" | Handled |
| Cost | 100 AI steps per user per day; tokens recorded in `agent_usage` (`wf:<run>:<block>`) | Handled |
| It takes long (search, reading apps) | 5-minute step timeout instead of 2 | Handled |
| Business knowledge | Memory, preferences, and up to 10 knowledge files per step (read_knowledge, only those files, no paid OCR) | Handled |
| What did it do? | Its tool calls are in the output (`used`) and shown under Last run | Handled |

## 6. Sensitive values

| Case | What happens | Status |
|---|---|---|
| A bot needs an API key | `request_secret` shows a secure form; the value goes from the browser to `PUT /secrets/:name`, encrypted (AES-256-GCM, bound to user + row); the model is told only "saved" | Handled, Tested |
| A forged "saved" answer | The server checks the row exists before telling the bot | Handled, Tested |
| A secret in a run's input, output or error | Replaced by `[secret:NAME]` before anything is stored or shown | Handled, Tested (base64/URL-encoded copies are Open) |
| A secret in a condition, Set field or AI prompt | Refused at publish | Handled, Tested |
| A secret deleted while a workflow uses it | Deleting is refused (409) and names the workflows | Handled |

## 7. Runs

| Case | What happens | Status |
|---|---|---|
| The worker restarts mid-run | Durable steps: a resumed run never repeats a finished block | Handled |
| Cancel while a block runs or waits | The row says cancelled first; a late block cannot revive the run | Handled, Tested |
| Editing a workflow while it runs | The run uses its saved copy | Handled |
| Two tabs edit the same workflow | The second save gets 409 "changed in another tab" | Handled |
| A loop in the graph | Refused on save | Handled, Tested |

## 8. Human approval and schedules

| Case | What happens | Status |
|---|---|---|
| "Ask me first" | The run waits (durably, `step.waitForEvent`) with its question; Approve goes on, Decline skips the path after it; no answer in time fails it | Handled, Tested |
| Two tabs answer | The first answer claims the wait; the second gets 409 | Handled, Tested |
| Schedules | Once, daily, weekly (days), monthly (31 = last day) or every N, at a wall-clock time in an IANA time zone (DST-safe) | Handled, Tested |
| A "once" schedule ran | The workflow (or task) turns itself off | Handled |
| Graphs saved before modes existed | Parsed with defaults on read, publish and in the cron | Handled |
| Bot tasks (Grok-style) | `scheduled_task`: at each time the prompt is a new message in the bot's chat, with all its tools; hourly at most, 20 per user, the daily chat limit applies; the bot can create them (asks first in Ask mode) | Handled, Tested |
| A task while the bot is busy | Skipped; the task shows why | Handled |

## 9. Still open (not built)

1. Nested For each (one per workflow today).
2. Custom triggers: Composio has no API for them; the Webhook trigger and the HTTP block cover "any other service".
3. Notifications outside the app (email, push) for a waiting approval or a turned-off workflow.
