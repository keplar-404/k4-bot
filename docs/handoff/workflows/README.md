# Workflows: handoff to the next agent

> The project-wide index (all features, open questions, uncommitted files) is `../README.md`. Read it first.

Last update: 2026-11-07. Branch `development`. **Nothing from this feature is committed yet**: run `git status` to see the files.

Read the files in this order. Each one is a full spec for a single part of the work.

| # | File | What it covers | State |
|---|------|----------------|-------|
| 00 | `README.md` (this file) | Product goal, repo rules, how to run things, checklist | — |
| 01 | `01-what-exists.md` | Every file already written, what it does, test results | reference |
| 02 | `02-finish-builder-ui.md` | Fix type errors, split files, wire Run + Runs drawer, browser test | **NEXT, in progress** |
| 03 | `03-engine.md` | Cloudflare Workflow that executes a graph, block by block | not started |
| 04 | `04-templates-and-conditions.md` | The `{{ }}` resolver and the If/Filter evaluator (pure functions) | not started |
| 05 | `05-realtime-and-run-viewer.md` | Live run state: Durable Object relay + canvas overlay + run history UI | not started |
| 06 | `06-triggers.md` | Manual/test run endpoint, schedule cron, public webhook route | not started |
| 07 | `07-security-and-limits.md` | Every limit and every check, in one table | spec |
| 08 | `08-testing.md` | Exact test plan (API with curl, UI with agent-browser), cleanup | spec |
| 09 | `09-later.md` | Composio app-event triggers and extras (the HTTP block is approved: `../agent-platform/05`) | backlog |

## 1. Product goal (what the user asked for, in their terms)

1. A **Connect** page listing every Composio app (~1,723), with search, a category filter, real logos, **Connect** and **Connected → Disconnect**. Each user logs in to their own accounts. → **DONE, tested.**
2. **`/dashboard/workflow`** overview: how many workflows there are, cards with run counts and health, a runs chart, and a **Create workflow** button. → **DONE, tested.**
3. **Builder at `/workflows/[id]`**, full screen (not inside the dashboard layout), in the style of Zapier/n8n:
   - a React Flow canvas;
   - a **floating left panel** with the blocks: triggers, logic, and every Composio app;
   - a **floating right panel** with the selected block's settings;
   - a top bar with the name, save state, issues, Run, and Turn on/off.

   Built with shadcn and the project theme, in light and dark. → **written, not compiled or tested yet** (02).
4. **Execution** (03–06):
   - blocks: If/else, Filter, Delay, Set fields, schedule and webhook triggers, Composio app actions;
   - **per-block Retry** (max attempts, delay, backoff) and **On error: stop / continue**;
   - **real-time** run state on the canvas: which block is running, what it is doing, the exact block and error message where it failed;
   - everything persisted in Postgres;
   - validation, rate limits, no infinite loops, no spam. Production grade.
5. The user's decisions so far:
   - retry is a per-block setting (**agreed**);
   - the limits in `07` (**agreed**);
   - the HTTP request block is **approved** (`../agent-platform/05`). Bots can create and run workflows; secrets go through the vault (`../agent-platform/03`); permission modes are in `../agent-platform/04`.

The user's working style: read and research first, think like a product engineer, a UX designer and an engineer, validate, then build. After building, **test it for real** in the browser.

## 2. Repo rules (follow them exactly)

- Monorepo with bun.
  - `apps/backend`: Hono on Cloudflare Workers, Durable Objects, Cloudflare Workflows, Drizzle + Neon Postgres, R2.
  - `apps/web`: Next.js 16 (Turbopack), shadcn "base-vega" on **@base-ui** (use `render={<Link/>}`, not `asChild`), Tailwind, zustand, `@xyflow/react` 12, sonner toasts, lucide icons.
- **Every file is at most 100 lines** (Biome formatting counts). Exceptions: `apps/web/src/components/ui/*`, `apps/web/src/lib/bloub/bot/*`, generated files. Feature folders: web `src/features/*`, backend `src/modules/*`. Pragmatic SRP only: no class hierarchies, no value objects.
- Keep Hono route **chaining** (`new Hono().get(...).post(...)`): the web app infers types from `AppType`.
- The web imports backend types straight from `@backend/modules/workflows/graph/schema` and `.../validate`. Keep that single source of truth. Do not duplicate the types.
- Comments explain *why*, not *what*. Keep existing comments and guards.
- **Never commit `.env` or `.dev.vars`.** Commit or push only when the user asks. Commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- If `.codegraph/` exists, use `codegraph explore "<symbols>"` before grepping.

## 3. Commands

```bash
# web
cd apps/web
bun run check-types                       # tsc
bunx biome check --write src/features/workflows src/app/workflows
# backend
cd apps/backend
bun run check-types                       # if present; else: bunx tsc --noEmit
bun run check:workflows                   # graph validation unit check (passes today)
bunx drizzle-kit generate                 # after schema edits; then make the SQL idempotent (IF NOT EXISTS)
bunx drizzle-kit migrate
# browser (see .claude/skills/next-dev-loop)
mise exec node@26.7.0 -- agent-browser ...
```

Dev servers: web on `localhost:3000`, backend `wrangler dev` (check `apps/backend/package.json` for the script and port). API base on the web side = `BASE` from `@/features/files/api/library`, routes under `/api/v1/...`.

The test login (an `@example.com` user) is in the previous session's scratchpad, which may be gone. If it is, create a new user through the sign-up page, or ask the user.

## 4. Master checklist

- [x] 02 — builder compiles and is lint-clean
- [ ] 02 — remaining file splits, browser test (light + dark)
- [ ] 04 — template resolver + condition evaluator, with a `check:` script
- [ ] 03 — `WorkflowRunner` Cloudflare Workflow, step rows in DB, retry/on-error, Composio execute
- [ ] 06a — `POST /workflows/:id/run` (manual + test), cancel, caps
- [x] 05 — live relay + canvas overlay + runs drawer + run detail
- [ ] 06b — schedule cron; 06c — public webhook route
- [ ] 08 — full test pass, then cleanup of test data
- [ ] Ask the user whether to commit/push
