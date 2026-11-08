# 00 — How the existing app works (read before changing anything)

Written after reading every backend file in full (`apps/backend/src`: 276 files, plus scripts and migrations), plus the web chat feature in full (prompt bar, chat view, stream reducer, hooks). Paths below are relative to `apps/backend/src` unless they start with `web/` (meaning `apps/web/src`).

## 1. Backend entry and plumbing

- `index.ts`:
  - Hono app: CORS (`middleware/cors.ts`, allows only `WEB_ORIGIN` and `BETTER_AUTH_URL`), `secureHeaders` (skipped for the computer stream; CORP cross-origin for file bytes), `bodyLimit` 1 MB;
  - `ipLimit` on `/api/v1/*` except `/auth/*` (Better Auth limits itself) and the stream;
  - routes mounted at `/api/v1`;
  - exports the DOs and Workflows for wrangler, and `AppType`.
- `routes.ts` mounts: `/auth`, `/bots`, `/chat`, `/computer`, `/files`, `/integrations`, `/composio`, `/workflows`, `/sandbox` (editor routes first), `/models`, `/memory`.
- `config/env.ts`: zod `envSchema` (all limits and kill switches live here) plus the binding types; `parseEnv` is cached per bindings object. **Add every new env var and binding here.**
- `shared/context.ts`: `getRequestContext(c)` → `{env, db, auth}` (memoised per request; Better Auth is built per request with `waitUntil`).
- `shared/validate.ts`: `validate(target, zodSchema)` → 400 `{error:"INVALID_INPUT", details}`. **Use it on every route input** (json, param, query).
- `shared/secrets.ts`:
  - `encryptSecret(env, plaintext, {userId, recordId, purpose})` / `decryptSecret`;
  - AES-256-GCM, AAD binds user + record + purpose; key `SECRETS_ENCRYPTION_KEY` with rotation via `_PREVIOUS`; `secretHint` shows the last 4 characters.
  - **Reuse this for the workflow secrets vault.** Do not write new crypto.
- `shared/relay-token.ts`: HMAC tokens `<exp>.<mac>` bound to `userId` + a scope string (the `threadId` argument, e.g. `computer:ws`); `timingSafeEqualString`. Used for every WebSocket and iframe that cannot send cookies or headers.
- `middleware/auth-guard.ts`: `authGuard` sets `c.get("session")`; 401 otherwise.
- `middleware/rate-limit.ts`: Cloudflare rate-limit bindings. A limiter outage fails open (logged).
  - `ipLimit` (`RL`, 100/min per IP);
  - `userLimit` (`RL_WRITE`, 20/min per user);
  - `workflowSaveLimit` (`RL_WF_SAVE`, 60/min);
  - `workflowRunLimit` (`RL_WF_RUN`, 10/min, **not used yet**).
  - Bindings and namespaces are in `wrangler.jsonc` (`1001`–`1004`; use `1005+` for new ones). Also add the name to the `binding` union type in `rate-limit.ts`.
- `scheduled.ts`: the daily cron `0 3 * * *` pauses stale sandboxes, refreshes the Composio catalog, prunes chat events older than 7 days (keeping each thread's newest). There is only one cron today; per-minute work must branch on `controller.cron`.
- DB: `db/index.ts` `createDb` = drizzle over Neon HTTP. **No interactive transactions**: `db.batch([...])` runs several statements as one transaction (used by the checkpointer). Migrations live in `apps/backend/drizzle` (0000–0015).

## 2. Schema (`db/schema/*`)

- **auth:** `user` (+ `composio_session_id`), `session`, `account`, `verification`, `rate_limit` (Better Auth).
- **bot:** id, userId, name, description, role (`assistant|advisor|coding|research|writing|custom`), roleTitle, subagentsEnabled, maxSubagents, maxParallelTools, shape/color/expression (avatar), modelId, reasoningEffort.
- **chat:**
  - `chat_thread` (botId, userId, title, contextTokens);
  - `chat_message` (id, threadId, role, parts jsonb, runId, seq);
  - `chat_event` (threadId, seq unique, type, payload): the relay log;
  - `agent_usage` (userId, threadId nullable, runId, model, tokens): **the daily budgets count these rows, so they are kept when chats are deleted.** Images use model `image:*`, OCR uses `ocr:mistral-ocr`.
- **checkpoint:** LangGraph tables (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`), keyed by thread id with no FK.
- **file:** `chat_file` (R2 `storageKey` `u/<userId>/<id>`, source `upload|generated|computer`).
- **integrations:**
  - `user_skill`, `user_mcp_server` (encrypted `secrets`, `secret_hint`);
  - link tables `bot_skill`, `bot_mcp_server`.
- **memory:** `bot_memory`, `user_preferences`.
- **research:** `research_task` (deep-research idempotency).
- **sandbox:** `bot_sandbox` (one per bot; usage seconds).
- **composio:** `composio_toolkit` (catalog cache).
- **workflow:** `workflow`, `workflow_run`, `workflow_run_step` (see `workflows/01`).

## 3. Chat run pipeline (the core: do not break it)

1. `POST /chat/threads/:id/messages` (`modules/chat/routes/runs.ts`):
   - ownership; `/deep-research` parsing (`chat/commands.ts`); `modelError`;
   - `quotaExceeded` (messages/day `MAX_RUNS_PER_USER`, tokens/day; free models exempt);
   - **one active run per thread** (409 `RUN_ACTIVE`);
   - `env.CHAT_RUN.create({id: runId, params})`, where `runId = messageId` for idempotent resends.
2. `ChatRunWorkflow` (`chat/run/workflow.ts`): `load-context` → `save-user-message` → a loop of **slices** (`step.do("slice-N")`, no retries, 25 min timeout):
   - `retry` → backoff `step.sleep`, up to `MAX_MODEL_RETRIES` (10);
   - `sleep` → `step.sleep` (from `wait_for`);
   - `needs_input` → `step.waitForEvent("user-input", 7 days)`. Approvals and `ask_user` answers come back here as the `resume` value.
   - At most `MAX_RUN_SLICES` slices.
3. `runSlice` (`chat/run/slice.ts`):
   - thread still owned? Stop pressed? Daily token budget;
   - loads skills (R2), connected MCP apps (`connectBotApps`, secrets decrypted for this slice only), the sub-agent context, the context length, memory;
   - `buildRunAgent` → `streamEvents` with `recursionLimit: RUN_SLICE_STEPS`;
   - polls Stop every 500 ms; `consumeRun` writes parts;
   - an interrupt → `pauseFor` (`chat/run/interrupt.ts`) publishes `run.waiting_approval` / `run.waiting_input` / `run.sleeping`;
   - always closes apps, saves usage, and releases the computer lease.
4. `buildAgent` (`agent/agent.ts`): Deep Agents `createDeepAgent` with:
   - tools: web (Tavily), sub-agents, computer, files, `featureTools` (sandbox, MCP apps, memory, async tasks);
   - `interruptOn: approvals`, a static map tool name → `{allowedDecisions}`, built from `agent/approvals.ts` (`fileApprovals`, `computerApprovals`, `sandboxApprovals`) plus MCP `apps.approvals`;
   - middleware from `agent/middleware/stack.ts`;
   - the system prompt from `agent/prompts/system.ts`.
   - **This is where permission modes plug in** (`agent-platform/04`).
5. **Middleware stack** (outermost first): tool errors → read-only tool retry (`RETRY_SAFE_TOOLS` + app read-only tools) → summarize at 80% → hide Deep Agents' `task` → parallel-tool limit → todo guard → group guard (hides pausing tools while sub-agents run) → extra (async notices) → PII redaction (cards and key formats) → computer screen → view images → free-vision. `stack.check.ts` asserts parts of this order. **New middleware goes in `extra`** or a clearly placed slot; update the check.
6. **Events and relay:**
   - `publishEvent(env, threadId, type, payload)` → `ChatRelayDurableObject /publish` (internal secret), which numbers it (seq), broadcasts it to the hibernated sockets, and inserts a `chat_event` row.
   - Clients connect to `/chat/threads/:id/ws?userId&token&lastSeq` (token from `POST /ws-token`, owner only) and get a replay plus live events.
   - History: `GET /threads/:id/messages` returns `pending` (the last open approval, question or sleep).
7. **Approve / answer:** `POST /chat/runs/:runId/resume` (`resumeRunSchema`: `decisions[]` or `answer`), checks the thread and that the run belongs to it → `instance.sendEvent("user-input")`. **Stop:** `POST /runs/:runId/stop` sets a flag in the relay DO; a waiting run is terminated.
8. **Parts** (`agent/parts.ts`, also imported by the web):
   - `text | reasoning | tool | file`;
   - tool output is clipped to 4,000 characters;
   - files are reported by tools through a `FILE_REF {json}` marker line, which `consumeRun` lifts into `part.files`. **To add a new UI card type** (workflow card, secret form, mode-switch button), either add a `Part` variant (and handle it in `consumeRun`, the web reducer `features/chat/lib/stream/*` and `features/chat/components/agent-parts/*`), or use a marker line like `FILE_REF`. The marker way needs fewer changes.
9. **Interrupt kinds already handled by the web:**
   - `actionRequests` → `ApprovalItem` (approve/reject all actions at once, `decideImpl`);
   - `ask_user` kinds `credentials|captcha|two_factor|payment|consent|info` → `AgentQuestion`; kind `confirm` → yes/no buttons;
   - `sleep` → `SleepingItem`.
   - New pause UIs (secret form, mode switch) should follow this exact pattern: an `interrupt({kind, ...})` in the tool → `pauseFor` publishes `run.waiting_input` with the kind → web `Prompts` switches on the kind → `resumeRun` answer.

## 4. Agent features

- **Domains** (`agent/domains/*`): the role defines the playbook, defaults and recommended skills/apps. Adding a role touches `bots/roles.ts`, `domains/index.ts` and the web's roles. Read the `domain-bots` skill.
- **Sub-agents** (`agent/tools/subagents/*`): groups of up to 20 (6 concurrent) per slice, with a mailbox, a `/shared/` folder and only read-only app tools. Usage is recorded. They never get the computer and never ask the user.
- **Async tasks** (`modules/async-tasks/*`): `AsyncTaskWorkflow` per task plus an `AsyncTaskRegistry` DO per thread; `async.task` event; at most 6 running.
- **Web tools** (`agent/tools/web/*`): Tavily. The user asked to remove all Tavily limits, **do not add them back.** `tavily_research` exists only in `/deep-research` runs and is idempotent through `research_task`.
- **Files** (`agent/tools/files/*`, `modules/files/*`): `saveFile` (storage quota `MAX_STORAGE_MB_PER_USER`, 25 MB per file), `read_document` (PDF tiers, office, text), `generate_image` (daily cap), copy/share with the computer.
- **MCP apps** (`agent/mcp/*`, `integrations/catalog/mcp.ts`): Airtable (remote) and shadcn (built-in). Approvals come from the `approval` regex per server. Their read-only tools may go to sub-agents.
- **Memory:** `update_memory` and `update_user_preferences` rewrite the whole text (8k / 4k max).
- **Models** (`agent/models.json`, `models.ts`): OpenRouter catalog; the default `anthropic/claude-sonnet-4.6`; `openrouter/free` is exempt from the app budgets.

## 5. Computer and sandbox (DO NOT TOUCH)

- `modules/computer/*`: `UserComputerDurableObject`, **one E2B desktop per user, named by user id**, built in layers (state → status → sleep → machine → lifecycle → power → session → meter → control → bots → panel).
  - Every bot gets **its own Linux account** (`botUnixUser`), its own home and its own Chrome profile and window class. This is "the bot's own PC" the user means.
  - One mouse/keyboard lease; daily minutes meter; idle and session limits; turning on needs approval.
  - Guards (`computer/guards/*`): URL SSRF checks, key names, typed-secret refusal, shell quoting. **`checkUrl` and `DENY_OUT` are reusable for the HTTP block.**
- `modules/sandbox/*`: `BotSandbox` DO, one E2B code sandbox per **coding** bot; daily minutes; editor socket.
- New features must not change these modules. If a new tool needs a file from or to the computer, use the existing `copy_to_computer` / `share_file` tools and the Files store.

## 6. Composio and workflows (this task)

See `connect/README.md` and `workflows/01-what-exists.md`. Key exports to reuse:
- `composioFor(env)`, `TOOLKIT_SLUG`;
- `userSession(db, composio, userId)`. Add `sandbox: { enable: false }` there, see `01-security.md` §5;
- `listConnections` / `ownConnection`, `listTools` / `getTool` (cached);
- `graphSchema`, `LIMITS`, `structureIssues`, `publishIssues`, `topoOrder`, `triggerOf`, `nextRunAt`, `hashToken`, `newWebhookToken`;
- the store functions in `modules/workflows/store/*` (all user-scoped).

## 7. Web map (`apps/web/src`)

- **Chat** (`features/chat`):
  - `components/chat-view/*`: `ChatView`, `Prompts` (renders approval / question / sleeping above the `PromptBar`), `ApprovalItem`, `AgentQuestion`;
  - `components/prompt-bar/*`: the custom composer. **Model and effort pickers:** `prompt-state.ts` (open flags, refs, menu positions), `composer-actions.tsx` (trigger buttons), `model-menu.tsx` / `effort-menu.tsx` (menus), `prompt-effects*.ts` (position + outside-click close), `prompt-handlers*.ts`. **The mode picker copies the effort-menu pattern exactly** (`agent-platform/04`). The `SOURCES` / most `COMMANDS` in `data.ts` are demo items the user chose to keep;
  - `hooks/use-chat/*`: state and refs, `send` / `deliver` (outbox in localStorage), `connect` (socket + backoff), `resume` (`decideImpl`, `answerImpl`, `stopImpl`), model save (`PUT /bots/:id/model`, debounced);
  - `lib/stream/*`: the pure reducer of wire events, with `*.check.ts` tests;
  - `components/agent-parts/*`: how tool parts render. Add `describe-*` entries for new tools (`describe.tsx` chains them).
- **Bots:** `features/bots/*` (form `components/avatar-create-dialog/*`: `use-bot-form*`, `submit-bot`; API `api/*`). New per-bot settings (apps, workflows) go into this form.
- **Others:** `features/integrations` (skills/MCP pages), `features/files`, `features/computer`, `features/workspace` (the right side bar; the user owns its persistence code), `features/code-editor`, `features/sandboxes`, `features/memory`, `features/avatar`. **Do not change these unless the spec says so.**
- `features/connect`, `features/workflows`, `app/workflows`: this task.
