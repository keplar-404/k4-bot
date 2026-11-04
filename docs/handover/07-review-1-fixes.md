# 07 — Review 1: findings and fix instructions

> **Status (2026-11-04): FIX-1 … FIX-19 were fixed by the reviewer.** Verified: backend + web `tsc`, `bun run check`
> (9 suites), `bun run check:chat` (10 suites), `next build`, Worker boot gate (`/health` 200, no errors), and a live
> E2B run (create → exec as `user` → edit without line numbers → preview host → pause/resume keeps files → kill).
> FIX-10 (async sub-agents) and FIX-18 (code editor) were first resolved by removing the half-built code, then
> **built properly by the reviewer** (same day):
> - Background tasks: `modules/async-tasks/` — `AsyncTaskRegistry` (DO per thread), `AsyncTaskWorkflow` (one per
>   task), the five tools, a notice middleware. Verified live in workerd: start → check → update (queued / restart) →
>   cancel (workflow terminated) → list.
> - Code editor: backend `sandbox/editor.ts` + `editor-routes.ts` (tree, file with hash, save with 409 conflict,
>   token-gated WebSocket that keeps the sandbox awake; tree command verified on E2B); web `features/code-editor/`
>   (CodeMirror, file tree, live agent edits, terminal, preview) opened from the side bar's Code tab or its code icon.
> - Per-bot sandbox section: the side bar's **Code** tab (`features/workspace/code/`).
> - Evals: `scripts/evals/coding/` (`bun run eval:coding [models…]`), results in `scripts/evals/coding/results.md`.
> Still blocked: dynamic sub-agents (`@langchain/quickjs` imports an export Deep Agents' Workers build lacks).

Reviewer verdict: **Phase 1 not accepted, Phase 2 not accepted.** The backend does not start, several working
features were removed, and the sandbox code has data-loss, billing and security bugs. Fix in the order below.
Each fix lists: Problem (with evidence), Fix (exact), Verify. Do not start new features until FIX-1 … FIX-12 pass.

Process rules you broke (do not repeat):
- Phase 2 was started before Phase 1 was accepted, and the design note was marked "reviewed" without a review.
- "tsc green" was reported for web; `bunx tsc --noEmit` in `apps/web` fails (FIX-11).
- The Phase 2 summary claims an "evals runner" while its own table says "not done". Reports must be consistent.
- `update_async_task` returns "Message queued" without doing anything: **never return a fake success**.
- New mandatory gate (added to `06-verification.md`): the Worker must actually boot (`wrangler dev` → `/api/v1/health` 200).

---

## Part A — Critical (blocks everything)

### FIX-1 — The backend Worker fails to build
**Evidence**: `wrangler dev` → `No matching export in "deepagents/dist/browser.js" for import
"SUBAGENT_RESPONSE_FORMAT_CONFIG_KEY"` from `@langchain/quickjs/dist/index.js`. The whole API (chat included) is down.
`node_modules/.bun` now holds **three** `deepagents@1.16.2` copies.
**Fix**:
1. Remove every import of `@langchain/quickjs` (`agent/agent.ts`, `agent/middleware/stack.ts`) and the
   `codeInterpreter` option. Remove `@langchain/quickjs` from `apps/backend/package.json`; `bun install`.
2. Dynamic sub-agents stay **blocked** (Phase 2 Task 7 said: STOP and report if it does not run on Workers — it does not).
   Write that in the report.
**Verify**: `cd apps/backend && bunx wrangler dev --port 8799`, then `curl localhost:8799/api/v1/health` → 200, and the
log has no `ERROR`. Paste the curl output in the report.

### FIX-2 — Restored features that were deleted from `agent/agent.ts`
**Evidence** (compare with `git show HEAD:apps/backend/src/modules/agent/agent.ts` and the earlier working version):
- `summarize: { model: createModel(["nostream"]), backend, now: options.compact }` is gone → the 80% summarizer is
  off, and `/compact` now uses the raw middleware with a streaming model, so the summary **leaks into the chat again**.
- `freeVision: model.id === "openrouter/free" && options.freeVisionModel ? extraModel(...) : undefined` is gone → the
  free router again sends images to text-only models.
- `...(options.memory ? createMemoryTools(options.memory) : [])` is gone from `tools` → the prompt tells the bot to
  call `update_memory` / `update_user_preferences`, which no longer exist.
**Fix**: in `agent/agent.ts` pass `summarize` and `freeVision` to `botMiddleware`, and add the memory tools back to
`tools`. In `middleware/stack.ts` delete the old `compact` option and its raw `createSummarizationMiddleware` branch —
`createSummarizeMiddleware(options.summarize)` handles `/compact` through `now`. Make `summarize` required.
Keep both files ≤ 100 lines (move `createSummarizeMiddleware` + constants to `middleware/summarize.ts`).
**Verify**: restore the deleted check in `files/documents/documents.check.ts` (it asserted that
`createFreeVisionMiddleware` swaps the model only for image calls — copy it from the previous version of
`modules/files/documents.check.ts` in git history: `git log -p -- apps/backend/src/modules/files/documents.check.ts`).
Add `agent/middleware/stack.check.ts`: build `botMiddleware` with fakes and assert the middleware **names** include
`SummarizationMiddleware` exactly once and `FreeVisionMiddleware` when `freeVision` is set.

### FIX-3 — `sandbox_edit` corrupts files
**Evidence**: `sandbox/exec.ts editFile` reads through `readFile`, which prefixes every line with `"N: "`, then writes
that back. Every edited file gets line numbers baked in.
**Fix**: add a private `readRaw(path)` (plain `sbx.files.read`) and use it in `editFile`. `readFile` (numbered) stays for
the tool output only. Count occurrences on the raw text.
**Verify**: `sandbox/exec.check.ts` with a fake sandbox object: edit "b"→"B" in "a\nb\nc" gives exactly "a\nB\nc".

### FIX-4 — E2B calls have no API key; sandbox rows are created with an empty user id
**Evidence**: `Sandbox.connect/create/pause(...)` are called without `{ apiKey }` (Workers have no `process.env`), and
`store.create(db, { …, userId: "" })` violates the `user_id` foreign key **after** the paid sandbox was created → leaked
sandbox. `countForUser(db, existing?.userId ?? "")` counts the empty user → the per-user limit is never enforced.
**Fix**:
- Every E2B call passes `{ apiKey: this.cfg.E2B_API_KEY }` (see how `computer/durable/sandbox.ts` does it).
- `ensure(purpose)` takes `{ purpose, userId }`. The DO stores `userId` in its `Core` on first use and rejects a call whose
  `userId` differs (ownership). Count with the real `userId` **before** `Sandbox.create`.
- If the DB insert fails after create, kill the new sandbox (`Sandbox.kill(id, { apiKey })`) and return `NOT DONE`.
- Create with `metadata: { app:"k4-bot", kind:"coding", userId, botId }`, `timeoutMs`, `lifecycle: { onTimeout: "pause" }`
  and the egress deny list (`DENY_OUT` from `computer/guards.ts`) — confirm option names in
  `node_modules/e2b/dist/index.d.ts` before writing them.
**Verify**: `sandbox/lifecycle.check.ts` with a fake store + fake E2B: limit enforced with the right user; insert failure
kills the sandbox; wrong user rejected.

### FIX-5 — Sandbox HTTP routes have no ownership check
**Evidence**: `sandbox/routes.ts` `GET /:botId`, `POST /:botId/start`, `POST /:botId/pause` never check that the bot
belongs to the signed-in user → any user can start/pause/read another user's sandbox by guessing a bot id.
`DELETE /:botId` deletes only the DB row: the E2B sandbox keeps running and billing, and the DO still points at it.
**Fix**: one helper `ownedBot(db, userId, botId)` (select from `bot` where id and userId) used by every `/:botId` route
→ 404 when not owned. Pass `userId` to the DO. `DELETE` calls a DO `destroy()` that kills the E2B sandbox
(`Sandbox.kill`), clears DO storage, then removes the row. Add zod validation for bodies.
**Verify**: route check script with a fake db: a bot of user B requested by user A → 404 for all five routes.

### FIX-6 — Idle pause never runs; "working"/"editor open" are never set
**Evidence**: `if (!this.ctx.storage.getAlarm())` tests a Promise (always truthy) → the alarm is never scheduled on
create; the resume path never schedules it either. `working` and `editorOpen` are never assigned anywhere.
**Fix**: `const at = await this.ctx.storage.getAlarm(); if (at === null) await this.ctx.storage.setAlarm(...)` after
create **and** resume. Every exec/read/write/edit sets `lastActivity` and `workingUntil = now + BUSY_MS`;
`working = now < workingUntil`. `editorOpen` = number of accepted editor WebSockets > 0 (Task 8; until then `false`).
Extract `shouldPause({ working, editorOpen, idleMs, limitMs })` as a pure exported function.
**Verify**: `sandbox/should-pause.check.ts` covering all four inputs.

---

## Part B — High

### FIX-7 — Tool retry repeats side-effecting actions
**Evidence**: `toolRetryMiddleware({ maxRetries: 2, onFailure: "continue" })` with no `tools` list retries **every**
tool (computer clicks/typing, `sandbox_exec`, `sandbox_write`, `share_file`, MCP writes). The report says "no exclude
option" — wrong: `ToolRetryMiddlewareConfig.tools` is an allowlist (`node_modules/.bun/langchain@1.6.0*/…/
middleware/toolRetry.d.ts` line 42).
**Fix**: `tools: ["tavily_search", "tavily_extract", "tavily_map", "tavily_crawl", "read_document"]` plus the
connected apps' **read-only** tool names (`options.apps.readOnly`), and a `retryOn` that uses
`isTransient` from `chat/run/provider-error.ts`.
**Verify**: add to `stack.check.ts` that the retry config's tool list contains no `computer`, `sandbox_*`, `share_file`.

### FIX-8 — The todo guard does not make the bot continue, and pollutes history
**Evidence**: `afterModel` returns `{ messages: [SystemMessage] }` without `jumpTo`, so the run still ends after the
reminder (the agent routes to END when the last AI message has no tool calls). The `SystemMessage` is then saved in the
conversation; a system message in the middle of history is rejected by some providers. The tool-call count covers the
**whole conversation**, so after any 3 tool calls ever, every later answer triggers the "verify" reminder.
**Fix**: read `node_modules/.bun/langchain@1.6.0*/node_modules/langchain/dist/agents/middleware/types.d.ts`
(`canJumpTo`, `jumpTo`). Declare `afterModel: { canJumpTo: ["model"], hook: … }` (confirm the exact shape), return
`{ messages: [new HumanMessage({ content: "[Automatic reminder] …" })], jumpTo: "model" }`. Count tool calls only
**since the last human message that is not an automatic reminder**. Keep the max-2 limit per run.
**Verify**: `todo-guard.check.ts` with fake states: (a) unfinished todos → reminder + jumpTo; (b) third stop → no
reminder; (c) previous turn had tool calls, this turn none → no verify reminder.

### FIX-9 — File previews are incomplete (Phase 1 Task 7 not done)
**Evidence**: `file-preview.tsx` renders an **empty** `<pre>` for text ("text loaded separately" — never loaded); no
Markdown, CSV, DOCX, XLSX, PPTX views; `use-file-blob.ts` caches failed responses (no `res.ok` check) forever.
Files tab deletes with no confirmation and no error handling.
**Fix**: implement exactly the file list in `03` Task 7 (`pdf-view`, `image-view`, `text-view` (md via `Markdown`, csv
table, code `<pre>`), `docx-view` (`docx-preview` `renderAsync`), `xlsx-view` (`exceljs`), `pptx-view`
(`@aiden0z/pptx-renderer` — read its README in `node_modules/@aiden0z/pptx-renderer`), `unsupported-view`), each lazy-
loaded with `await import`. In `use-file-blob`: throw on `!res.ok`, delete the cache entry on failure, expose `error`.
Files tab delete: reuse `DeleteFileDialog`, `toast.error` on failure.
**Verify**: manual QA `06` §2 step 3 with real files of each type; report each result.

### FIX-10 — Async sub-agents are dead code
**Evidence**: `SubagentTaskRegistry` is not exported from `index.ts` nor bound in `wrangler.jsonc`;
`createAsyncSubagentTools` is never called; it uses `fetch(registryUrl)` instead of a Durable Object stub; nothing runs a
task, so every task stays `pending`; `update_async_task` is a fake success.
**Fix**: either implement `04` Task 6 completely (binding, `SubagentTaskWorkflow`, stub calls, inbox, cancel via
workflow `terminate()`, notification) **or** delete `agent/async-subagents/` and mark Task 6 "not started" in the report.
Do not ship it half-done.

### FIX-11 — Web does not type-check; sandboxes page calls the wrong server
**Evidence**: `apps/web` `tsc`: `src/app/dashboard/sandboxes/page.tsx(14,35) TS2345`. The page fetches
`/api/v1/sandbox` (relative → the Next.js origin, always 404) instead of the API `BASE`; uses `any`; shows bot ids
instead of names; no actions.
**Fix**: `features/sandboxes/api.ts` using `BASE` + `credentials: "include"` (pattern: `features/files/api/library.ts`);
typed rows (import the row type from `@backend/db/schema` or define it); join bot names (server side: left join `bot`
in `listForUser`); shadcn `Table`, status `Badge`, Start/Pause/Delete with `AlertDialog` confirmation (bot name +
purpose). Split into ≤ 100-line files.
**Verify**: web `tsc` green; manual QA `06` §3 step 6.

### FIX-12 — Office reader bugs
**Evidence**: `office/xlsx.ts` cell regex `<c[^>]*r="…"[^>]*?(?:t="([^"]*)")?[^>]*>` usually fails to capture `t`
(the lazy `[^>]*?` + optional group lets the greedy `[^>]*` eat `t="s"`), so shared-string cells come out as numbers;
empty cells are skipped so columns shift; `.ods` and `.xls` (not OOXML zips) go to the xlsx parser and throw; `readOffice`
has no try/catch, so one bad file crashes the tool call.
**Fix**: parse attributes per cell (`/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g`, then read `r` and `t` from the
attribute string separately); place cells by column letter (A=0, B=1, … AA=26) filling gaps with ""; handle
`t="inlineStr"` (`<is><t>`). Route `.ods`/`.odt` to a small `opendocument.ts` (zip → `content.xml` text) or return a clear
`NOT DONE`; `.xls` → `NOT DONE: old Excel format, save as .xlsx`. Wrap `readOffice` in try/catch → `NOT DONE: could not
read "<name>": <reason>`. Create the fixtures + `office.check.ts` required by `03` Task 3 (generate fixtures with a
script; include a sheet with an empty middle cell and a shared string).
**Verify**: `office.check.ts` green.

---

## Part C — Medium (fix after A and B)

- **FIX-13 Sandbox tools**: `sandbox_list_all` and `sandbox_delete` (with approval in `agent/approvals.ts` showing owner
  bot, purpose, last used) are missing. `search` builds `rg ${JSON.stringify(pattern)} ${path}` — JSON quoting is not
  shell quoting (`$(...)` still expands) and `path` is unquoted: use a single-quote shell escaper
  (`'` → `'\''`) for every interpolated value. `getHost` hand-builds `https://<id>-<port>.e2b.dev` — use the SDK's
  `sbx.getHost(port)`. Every DO `fetch` route: try/catch → `{ ok:false, error }`; tools turn that into `NOT DONE: …`.
  `sandbox_exec`: clamp `timeout_s` to 1…600.
- **FIX-14 Sandbox metering + cron**: `SANDBOX_MAX_MINUTES_PER_DAY` is declared but never enforced; the cron safety net
  in `scheduled.ts` is missing. Implement per `04` Task 3.
- **FIX-15 Workspace UI**: use AI Elements `web-preview` for the browser (spec `03` Task 6; `npx ai-elements@latest add
  web-preview`, then wrap its parts); `close(id)` must keep the current tab active when closing an inactive tab;
  persist `activeId`; remove `as any` in `workspace-sidebar.tsx` (type `WorkspaceTab.file` properly); the mobile Sheet must
  show the same tabs as desktop, not only the computer; `normalizeUrl` must also reject `0.0.0.0`, `169.254.*`,
  `*.localhost`, `[::1]`, `[fc..]`/`[fd..]`.
- **FIX-16 file-card**: `try { ws = useWorkspace(); } catch {}` — add a non-throwing `useOptionalWorkspace()` that returns
  `null` outside the provider, and use it.
- **FIX-17 bot page**: `app/dashboard/bot/[id]/page.tsx` now starts with a byte-order mark before `"use client"` and
  lost its explanatory comments (the Suspense/`useParams` note, the keyed `ChatView` note). Remove the BOM, restore
  the comments.
- **FIX-18 Code editor**: the dialog is an unconnected `<textarea>`; nothing opens it. Leave it out of the UI until
  `04` Task 8 is implemented properly (ask the reviewer which editor package to install first), or implement Task 8.
- **FIX-19 Coding domain**: `recommended.skills` ids (`mattpocock/skills/tdd`, `obra/superpowers/systematic-debugging`,
  `shadcn-ui/ui/shadcn`) must exist in `integrations/catalog/skills.ts` **and** on skills.sh; verify each, drop any that
  do not resolve.

---

## Report back

Use the `06-verification.md` template, one row per FIX-n with status and the exact verification output.
The reviewer will re-run: web + backend `tsc`, `bun run check`, `bun run check:chat`, the Worker boot gate, and the
check scripts named above.
