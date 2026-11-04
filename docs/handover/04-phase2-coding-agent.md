# 04 — Phase 2: Coding agent, sandboxes, async & dynamic sub-agents

Start only after the Phase 1 report is accepted. Same task format: Goal, Files, Spec, AC, Verify.

---

## Task 1 — Research and design note (no code)

Read: Anthropic "Building effective agents" and Claude Code docs (tools, planning, sub-agents, context), SWE-agent
paper (agent-computer interface: small focused tools, linted edits, bounded output), OpenHands (sandbox + event
stream), Aider (repo map), Deep Agents docs (subagents, async, dynamic, interpreters), E2B docs (lifecycle, pause/
resume, timeouts, templates, metadata).

Write `docs/handover/phase2-design.md` (≤ 200 lines): tools list with exact schemas, harness loop, context strategy,
sandbox lifecycle state machine, data model, UI map. **Send it for review before Task 2.**

---

## Task 2 — Sandbox data model + limits (backend)

**Files**: `db/schema/sandbox.ts`, migration via `db:generate`/`db:migrate`, `modules/sandbox/store.ts`, env vars.

**Spec**
```
table bot_sandbox
  bot_id      text PK → bot.id ON DELETE CASCADE      -- ONE sandbox per bot, enforced by the PK
  user_id     text → user.id ON DELETE CASCADE, index
  sandbox_id  text NOT NULL                            -- E2B id
  status      text NOT NULL  -- "running" | "paused" | "creating" | "error"
  purpose     text NOT NULL  -- why the bot created it (shown in approvals/UI)
  template    text NOT NULL
  created_at, last_used_at, last_activity_at timestamps
```
Env (in `config/env.ts`, documented): `SANDBOX_MAX_PER_USER` (default 3), `SANDBOX_IDLE_MINUTES` (default 10),
`SANDBOX_TEMPLATE` (default E2B `base`/`code-interpreter` — confirm template ids in E2B docs),
`SANDBOX_MAX_MINUTES_PER_DAY` (default 240).
- **No automatic deletion.** Sandboxes are only deleted by the user, or by a bot with the user's approval.
- Usage minutes counted like the computer meter (see `computer/durable/meter.ts`).

**AC**: inserting a second sandbox for the same bot fails at the DB level; `store.ts` exposes `getForBot`, `listForUser`,
`countForUser`, `create`, `setStatus`, `touch`, `remove` — each with user ownership in the WHERE.

---

## Task 3 — Sandbox lifecycle Durable Object (backend)

**Goal**: one `BotSandbox` Durable Object per bot (name = bot id) owns its E2B sandbox, like `UserComputer` owns the
desktop. Split into layers/files ≤ 100 lines (state, lifecycle, exec, files, meter, alarm).

**Spec — lifecycle**
- `ensure(purpose)`: if a row exists → resume (`Sandbox.connect`) and return; else check `countForUser < MAX` (else
  `NOT DONE: you already have N sandboxes (limit M). Ask the user to delete one.`), create with metadata
  `{app:"k4-bot", kind:"coding", userId, botId}`, `lifecycle: { onTimeout: "pause" }`, network deny private ranges
  (reuse `DENY_OUT` from `computer/guards.ts`), insert row.
- **Pause only when idle AND nobody is working AND no editor is open**:
  - "working" = a bot tool call in the last `BUSY_MS` (copy from computer) or a run slice in progress
    (`markWorking/releaseBot` pattern from `computer/durable/status.ts` and `slice.ts`);
  - "editor open" = an editor WebSocket connected to this DO (Task 8) — while connected, never pause;
  - alarm every 30 s: if not working, no editor socket, and `now - lastActivity > SANDBOX_IDLE_MINUTES` → `Sandbox.pause`.
- Daily minutes cap per user: at the cap → pause and refuse new work with a clear message.
- Cron safety net in `scheduled.ts`: for rows `running` with no activity for 2× idle → ask the DO to pause (not delete).

**AC**: idle sandbox pauses after the idle window; a sandbox with an open editor or a working bot never pauses;
resume after pause keeps files; limits enforced; a check script tests the pause decision function
(`shouldPause({working, editorOpen, idleMs, limitMs})`).

---

## Task 4 — Sandbox tools for the coding bot (backend)

Tools (each its own file in `agent/tools/sandbox/`, schemas with `.describe`, output capped at 30k chars like the
computer):
`sandbox_start({purpose})`, `sandbox_exec({command, cwd?, timeout_s?})`, `sandbox_read({path, offset?, limit?})`,
`sandbox_write({path, content})`, `sandbox_edit({path, old, new})` (exact replace, fails if not unique — like this
harness), `sandbox_search({pattern, path?})` (ripgrep), `sandbox_list({path})`, `sandbox_preview({port})` (returns the
public preview URL via E2B `getHost`), `sandbox_stop()`, `sandbox_list_all()` (user's sandboxes: bot, purpose,
status, last used), `sandbox_delete({bot_id})`.
- **One per bot, verified in the tool**: `sandbox_start` checks `getForBot` first and returns the existing one.
- **Deleting another bot's sandbox requires approval**: add `sandbox_delete` to `interruptOn` (`agent/approvals.ts`)
  with an approval payload that includes owning bot name, purpose, created/last used, status. The web approval UI
  (`features/chat/components/chat-view/approval-item.tsx` or equivalent) must render these fields.
- Commands run as a non-root user; reuse quoting helpers; deny `sudo`; timeouts default 120 s, max 600 s.

**AC**: a check script covers argument validation and the one-per-bot rule (mock store); a live test runs
`echo hello`, writes/reads a file, and returns a preview URL (report billing errors honestly).

---

## Task 5 — Coding bot role, prompt and skills (backend)

**Files**: `agent/domains/coding/index.ts` (spec), `domains/coding/prompts.ts`, register in `domains/index.ts`, role
label/icon in web `features/bots/roles.ts` (already has "coding" — keep it, upgrade its spec).

**Spec**
- Coding bot = all default features (memory, files, web, MCP, skills, computer) **plus** sandbox tools + async/dynamic
  sub-agents.
- Prompt (concise, every line costs tokens): explore before editing (list/search/read); plan with todos; small edits
  with `sandbox_edit`; run tests/linters after every change; never claim success without running it; summarize
  changed files at the end; use sub-agents for independent parts (tests, docs, research, review) — **mandatory when a
  task touches ≥ 3 files or has ≥ 2 independent parts**; ask the user before destructive commands
  (`rm -rf`, force push, dropping data).
- Recommended skills (catalog ids in `integrations/catalog/skills.ts`): add a coding set (testing, git workflow,
  code review). Confirm ids exist on skills.sh before adding.
- Enforcement: the todo guard (Phase 1 Task 4) applies; add a "sub-agents for big tasks" reminder in the same guard
  style when the plan has ≥ 3 independent todos and no sub-agent was started.

---

## Task 6 — Async sub-agents on Cloudflare (backend)

**Goal**: the five Deep Agents async tools, built on this app's Workflows + Durable Objects (no Agent Server).

**Design**
- `SubagentTaskRegistry` Durable Object, one per parent thread: SQLite table `tasks(id, agent_name, status, input,
  result, created_at, updated_at, checked_at)`; statuses `pending | running | success | error | cancelled | waiting`.
- `SubagentTaskWorkflow` (new Workflow binding in `wrangler.jsonc`): runs one sub-agent (reuse
  `tools/subagents/member.ts` member builder) in slices, writes progress/result to the registry and R2
  (`subagent-results/<taskId>.md` for long results), publishes `tool.progress`/`subagent.*` events to the thread relay.
- Tools: `start_async_task({agent, description})` → creates registry row + workflow, returns task id immediately;
  `check_async_task({task_id})`; `update_async_task({task_id, message})` (append to the task's inbox; the workflow
  reads it between steps); `cancel_async_task({task_id})` (workflow `terminate()` + status cancelled);
  `list_async_tasks()`.
- Task ids stored in a dedicated state channel on the parent (not only in messages) so summarization does not lose
  them — mirror Deep Agents' `asyncTasks` idea: store in the registry DO and re-inject a short list into the prompt.
- When a task finishes while the parent run is idle: post a notification message to the thread (start a new run with
  an automatic message, like `collectUnfinished` does in `slice.ts`).
- Limits: max 6 concurrent tasks per thread, max 20 per day per user, each counted in `agent_usage`.

**AC**: start returns instantly; check shows running → success with result; update reaches a running task; cancel
stops it (workflow terminated); list survives a `/compact`; a check script covers the registry state machine.

---

## Task 7 — Dynamic sub-agents (backend, gated)

1. Spike first: does `@langchain/quickjs` `createCodeInterpreterMiddleware()` run on Workers (`wrangler dev`)? It uses
   WASM — confirm. Write the result in the report.
2. If yes: add it to the **coding** bot only, with the configured sub-agents (coder, tester, reviewer, researcher),
   so the model can call `task()` from interpreter code in loops/batches. Cap parallel `task()` at the bot's
   `maxSubagents`.
3. If no: STOP and report; do not substitute an unsafe `eval`.

---

## Task 8 — Full-page code editor (web)

**Goal**: an icon in the right side bar opens a full-screen editor (close button top-right) showing what the agent
writes in real time; the user can edit and save back to the sandbox.

**Files** (`features/code-editor/`): `code-editor-dialog.tsx` (full-screen shadcn Dialog/Sheet), `file-tree-pane.tsx`
(AI Elements File Tree), `editor-pane.tsx`, `terminal-pane.tsx` (AI Elements Terminal, read-only stream of
`sandbox_exec` output), `preview-pane.tsx` (Web Preview of `sandbox_preview` URL), `use-sandbox-socket.ts`.

**Spec**
- Opening the editor calls `POST /sandbox/:botId/open` → DO `ensure()` (resume if paused) and opens a WebSocket;
  while connected the sandbox never pauses (Task 3). Closing the editor closes the socket.
- Live updates: the DO broadcasts `file.changed {path}` when a bot tool writes/edits, and `exec.output` chunks. The
  editor refreshes the open file if it has no unsaved user changes; otherwise shows "Changed by the agent — reload?".
- Editor component: use a well-known, maintained editor — **ask before installing** (candidates: `@monaco-editor/react`,
  `@uiw/react-codemirror`). Read-only until the user clicks Edit; Save = `PUT /sandbox/:botId/file`.
- Conflict safety: Save sends the file's last-known hash; the server rejects if the file changed since (409) and the UI
  offers reload/overwrite.

**AC**: agent edits appear within ~1 s; user save persists in the sandbox; sandbox stays running while open and
pauses after idle once closed; close button returns to chat.

---

## Task 9 — Sandbox management UI (web)

- **Per bot**: in the workspace side bar, a "Sandbox" section/tab: status, purpose, last used, Start/Pause/Delete
  (Delete confirms with bot name + purpose).
- **Global**: page `app/dashboard/sandboxes/page.tsx` + left-nav item: table of all sandboxes (bot, purpose, status,
  last used, minutes today), limits shown ("2 of 3 sandboxes"), actions per row.
- Routes: `GET /sandbox`, `GET /sandbox/:botId`, `POST /sandbox/:botId/{start,pause,open}`, `DELETE /sandbox/:botId`,
  `GET/PUT /sandbox/:botId/file`, `GET /sandbox/:botId/tree`. All with `authGuard`, ownership, `userLimit` on writes.

---

## Task 10 — Evals + end-to-end test

- `apps/backend/evals/coding/`: 5–8 small tasks (fix a failing test, add a function with tests, refactor without
  breaking tests, implement a tiny CLI, read a repo and answer). Each task: setup files, the prompt, and an automatic
  pass/fail command run in the sandbox (`npm test` / `python -m pytest`).
- A runner script that, for each task, creates a fresh sandbox, runs the coding bot headless (`buildAgent` + MemorySaver,
  like `agent/cli.ts`), runs the check, records pass/fail, steps, tokens, time; writes `evals/coding/results.md`.
- Run with a free model and (if credit allows) one paid model. Report the table honestly.

**AC**: runner works end to end; results table produced; failures analyzed in the report.

## Task 11 — Phase 2 verification

Run `06-verification.md` fully and write the Phase 2 report.
