# 03 — The bot creates and runs workflows + the secrets vault

User decision: **the bot can create a workflow and run it automatically.** If the workflow needs an API key or other private information, the bot asks the user to enter it in a secure form. The value is saved encrypted in the DB, and the bot is told only that it was saved. The workflow uses it server-side. **No secret value is ever sent to the bot.**

Prerequisites: permission modes (04), app tools (01, for `app_find_actions` / `app_action_details`), the engine (`../workflows/03`, `06a`).

## A. Secrets vault

### Table `user_secret` (migration, idempotent)
```
id text pk (uuid), user_id text fk user cascade,
name text not null              -- /^[A-Z][A-Z0-9_]{1,40}$/  e.g. STRIPE_API_KEY
label text not null default ''  -- what it is for, ≤120, shown to the user
value text not null             -- encryptSecret(env, value, {userId, recordId: id, purpose: "workflow-secret"})
hint text                       -- secretHint(value)
created_by_bot_id text null, created_at, updated_at
unique (user_id, name)
```
Limit: 50 per user; value ≤4 KB.

### Routes `modules/secrets/routes.ts` (authGuard, userLimit, zod on everything)
- `GET /secrets` → `[{id, name, label, hint, createdAt}]`. **Never the value.**
- `PUT /secrets/:name {value, label?}` → encrypt and upsert. 503 if `SECRETS_ENCRYPTION_KEY` is missing (`SecretsUnavailableError`, like `integrations/routes/mcp-input.ts`).
- `DELETE /secrets/:name` → refused with 409 while an **active** workflow references it (list them); otherwise deleted.
- A settings page (`/dashboard/secrets`, or a section on the Connect page): list, replace, delete, with `PageHeader`.

### The bot asks for a secret: tool `request_secret`
`request_secret({ name, label, why })`:
1. Server-side validation: the name regex; the label and why lengths.
2. If the secret already exists, return "Already saved as {{secrets.NAME}}." (no interrupt).
3. Otherwise `interrupt({ kind: "secret", name, label, why })`. **The run pauses.**
4. Web: `Prompts` renders `SecretRequestItem` for `kind === "secret"`:
   - a password input (`type="password"`, `autocomplete="off"`), the label and why, and a **"Save securely"** button;
   - the value is sent with `PUT /secrets/:name` (**not** through `resumeRun`, so it never enters the run's event, checkpoint or model context);
   - then `resumeRun(runId, threadId, { answer: "saved" })`; a "Cancel" button answers "cancelled".
5. The tool returns to the model only: "The user saved NAME. Use it as {{secrets.NAME}} in workflow fields." On anything else: "The user did not provide NAME."
6. Also verify server-side: after a "saved" answer, the tool checks that the secret row exists. A forged "saved" answer without a row says "not provided".

### Leak prevention (all mandatory)
- `{{secrets.NAME}}` is resolved **only in the engine** (`../workflows/04` resolver gets a `secrets` provider), only for the run owner, only when the step executes.
- Before any step input/output is stored, published or returned (to the run viewer, `run_workflow` results, logs), **redact**: replace every decrypted value used in that run with `[secret:NAME]`. Keep a per-run `Set` of used values.
- `get_workflow` / `list_my_workflows` show the template `{{secrets.NAME}}`, never values.
- The PII middleware already redacts key-shaped strings in model I/O; that is a backup, not the defence.
- The chat transcript must never contain a secret. The form posts directly; the user message is not used.
- Secrets are usable in: app action arguments, HTTP block headers, URL query and body (`05`). **Not** in conditions or Set fields (they would move the value into outputs).

## B. Authoring tools (`modules/agent/workflows/authoring/*`, each ≤100 lines)

| Tool | Mode rules | What |
|---|---|---|
| `list_my_workflows()` | any | name, id, status, trigger, description, inputs; the user's own, ≤100 |
| `get_workflow({id})` | any | the draft graph (compact) and its `issues` |
| `create_workflow({name, description, graph, turn_on?: boolean})` | Plan: hidden. Ask: an approval card **when `turn_on` is true** (a draft alone is harmless). Allow all: no card | Parse with `graphSchema`. Add positions if missing (`graph/layout.ts`, x = level × 280, y = index × 140). `structureIssues` must be empty. `createWorkflow` (MAX_WORKFLOWS applies; ≤10 per bot per day). If `turn_on` and `publishIssues` is empty, publish with the same code path as `POST /:id/publish` (extract it into `store/publish.ts` and have both use it). Returns `{id, status, issues, url}` plus a workflow-card marker (below) |
| `update_workflow({id, graph, turn_on?})` | like create | `saveDraft` with a fresh `expectedUpdatedAt`. For an active workflow, `turn_on` re-publishes. Only the user's own workflows |
| `run_workflow({workflow, inputs})` | see `02` | starts a run |
| `pause_workflow({id})` | Ask: card; Allow all: no card | turns it off |

There is **no delete tool**; deleting stays a user action.

### Workflow card in chat
- Use a marker line like `FILE_REF` (`agent/parts.ts`): `WORKFLOW_REF {"id","name","status","issues"}`, lifted by `consumeRun` into `part.workflows`. Add the field to `ToolPart` and handle it in the web reducer.
- The web component `features/chat/components/agent-parts/workflow-card.tsx` shows:
  - a mini read-only React Flow preview (reuse `graphToFlow` + `nodeTypes`, `nodesDraggable={false}`, height 200; fetch with `getWorkflow(id)`);
  - the status badge;
  - **Open in builder**;
  - **Turn on** when it is off and has no issues (a user click, through the normal API).

### Helping the model write valid graphs
- A built-in skill file `workflow-authoring/SKILL.md` (Deep Agents skills are read on demand; see `agent/skills-backend.ts`; add it to every bot's skills map when the workflow tools are on). It covers:
  - the block kinds and their config;
  - the reference grammar (`{{trigger.*}}`, `{{steps.<id>.output.*}}`, `{{secrets.NAME}}`);
  - three complete examples;
  - the rules: one trigger, no loops, If edges carry `branch`, pin `version` from `app_action_details`, use only connected apps, ask for secrets with `request_secret` and never ask for them in chat text.
- Errors come back as readable zod and `structureIssues` messages, so the model can fix the graph and retry.

## C. Done when
- "Every weekday at 8 send me a Slack DM with today's calendar" in Allow all → the workflow is created, turned on and shown as a card; the schedule runs it.
- "Post new Stripe charges to Slack" → the bot calls `request_secret("STRIPE_API_KEY")` → the form appears → saving resumes → the workflow uses `{{secrets.STRIPE_API_KEY}}` in an HTTP block → run steps show `[secret:STRIPE_API_KEY]`, never the key. Searching the `chat_event`, `chat_message`, `checkpoints` and `workflow_run_step` tables for the key value finds nothing (do this test for real).
- Plan mode: no authoring tool runs; the bot proposes the workflow as a plan.
