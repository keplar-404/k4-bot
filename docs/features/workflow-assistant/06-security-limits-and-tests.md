# 06 — Security, limits, and tests

> **Status: DONE (except the manual run)** (2026-11-11)
> - Done: `RL_ASSISTANT_MSG` (10/min/user), one active run per user (409 BUSY), daily token budget (before start and each
>   slice), 40 slices per turn, 10 test runs per turn, message ≤ 8,000 chars, ≤ 5 files, 200 threads, memory ≤ 8 KB,
>   ownership on every route/tool, confirmations for turn on / share. Checks: `assistant/graph-edit.check.ts`,
>   `graph/ai-block.check.ts`, `engine/blocks/answer-schema.check.ts` (all in `check:workflows`). Both apps type-check.
> - Done (follow-up): `workflows/store/lock.check.ts`, `assistant/limits.check.ts` (backend `check:workflows`), web
>   `assistant/progress.check.ts` (web `check:workflows`). `publish.check.ts` fixed: its test graphs skipped schema defaults
>   (`mode: "for"` on delays; Ask a bot blocks without `agent` now count as bot blocks, matching old behaviour). The full
>   backend `bun run check` passes; both apps type-check; `wrangler deploy --dry-run` bundles.
> - Not done: the manual test plan below — it needs the migration applied to your database and the app running.

Apply while building 01–05. A feature is not done until every box here is ticked.

## Abuse and cost limits

- [ ] New rate limit bindings in `apps/backend/wrangler.jsonc` (copy existing `ratelimits` entries, new
      `namespace_id`s) and add names to the `Binding` union in `middleware/rate-limit.ts`:
      - `RL_ASSISTANT_MSG`: 10 messages / 60 s per user (`POST /assistant/threads/:id/messages`).
      - Reuse `RL_WRITE` for thread create/rename/delete, memory PUT, stop.
- [ ] One active assistant run per user (DB check in a transaction or a conditional insert; 409 `BUSY`).
- [ ] Daily token budget: assistant usage counts toward `MAX_DAILY_TOKENS_PER_USER` (checked before start and
      between slices, like chat's slice). Free models follow chat's rule.
- [ ] Per run caps: `MAX_ASSISTANT_SLICES`, wall clock, max tool calls (e.g. 150), max test runs started by one
      assistant run (e.g. 10). Test runs also go through the existing `RL_WF_RUN` / `checkCaps`.
- [ ] Input caps: message ≤ 8,000 chars, ≤ 5 files per message, file sizes per the files module, thread title ≤ 80,
      memory ≤ 8 KB, 200 threads per user.
- [ ] The workflow limits still apply (50 blocks / 100 edges / 100 workflows / 25 active) because the assistant
      writes through the same store and schema.

## Ownership and privacy

- [ ] Every assistant route and tool resolves objects through the signed-in user id (threads, runs, files,
      workflows, bots). Never trust an id from the client or from the model alone.
- [ ] The relay socket accepts only a signed, short-lived token for that user (copy `workflows/live/token.ts`).
- [ ] The assistant never sees secret **values**: it may reference `{{secrets.NAME}}` and list secret **names** (if
      a tool for that is added), nothing more.
- [ ] Webhook tokens are never returned to the model (same rule as `agent/workflows/run.ts` turn on).
- [ ] Run outputs given to the model are capped (8 KB) and labelled as data.
- [ ] `save_memory` content: no secrets, no message bodies from runs (prompt rule + strip anything matching the leak
      patterns in `graph/portable.ts` `findLeakedKeys` before saving).
- [ ] Turning a workflow on and sharing with bots require an explicit user confirmation (interrupt card), even if
      the model decides to do it.
- [ ] Prompt injection: content of emails, web pages, files and run outputs is data; the system prompt says so and
      the confirmations above are the hard guard.

## Checks to write (`*.check.ts`, add to `apps/backend/package.json`)

- [ ] `assistant/agent/tools/edit.check.ts`: add/update/remove/connect on a sample graph keep it valid; positions of
      existing nodes are preserved; invalid slugs/kinds are rejected with a readable message.
- [ ] `assistant/lock.check.ts`: locked workflow refuses autosave/import/publish for others, allows the owning run,
      stale lock is ignored.
- [ ] `engine/ai-structured.check.ts` (from 01).
- [ ] `assistant/limits.check.ts`: second active run → BUSY; message too long → 400.
- [ ] Web: a small `assistant/progress.check.ts` for the todo → rows mapping (pure function).

## Manual test plan

1. Fresh user, no apps: "Fetch my last 10 Gmail emails and summarise each with a normal bot". Expect todo list,
   blocks appear live, connect card for Gmail, then a test run visible on the canvas, final answer.
2. Close the tab mid-run, reopen after a minute: finished answer + canvas updated + unlocked.
3. Press Stop mid-run: stops within one slice, canvas unlocked, partial changes kept.
4. Two tabs on the same workflow: both update; both locked.
5. Ask to "turn it on": confirmation card; declining leaves it off.
6. Upload a screenshot of an n8n/Zapier flow: "build this" → reasonable workflow.
7. Spam: 11 messages in a minute → rate limited message; a second run while one is active → BUSY.
8. Budget: set `MAX_DAILY_TOKENS_PER_USER` low in `.dev.vars` → run refuses with the budget message.
9. Ask a bot: Normal bot + structured fields, If on a field, export → import keeps fields, strips botId.

## Definition of done

- [ ] `bunx tsc --noEmit` clean in `apps/backend` and `apps/web`.
- [ ] All `check:*` scripts pass (note: `publish.check.ts` was already failing before this work at line 33 — fix or
      document it, do not hide it).
- [ ] `bunx biome check` clean on touched web files.
- [ ] Docs: add a short section to `docs/features/workflows.md` linking here, and update `docs/architecture/data-model.md`
      with the new tables.
