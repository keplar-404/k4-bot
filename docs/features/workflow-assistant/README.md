# Workflow Builder: Ask a bot upgrades + Workflow Assistant (handover)

Two features for the workflow builder page (`/workflows/[id]`). Read this file first, then the task files in order.
Each task file is self-contained: context, exact files, steps as checkboxes, and acceptance criteria.

| File | What | Size |
|---|---|---|
| [01-ask-a-bot-upgrades.md](01-ask-a-bot-upgrades.md) ✅ DONE | "Normal bot" + model picker, structured output builder, example placeholders | small (1–2 days) |
| [02-assistant-backend-data-and-runs.md](02-assistant-backend-data-and-runs.md) ✅ DONE (changes noted) | Tables, durable run (Cloudflare Workflow), per-user relay, routes | large |
| [03-assistant-agent-and-tools.md](03-assistant-agent-and-tools.md) ✅ DONE (changes noted) | The Deep Agent: prompt, todo list, tools (edit canvas, JSON, test run, turn on, share with bots), memory | large |
| [04-assistant-live-canvas-sync.md](04-assistant-live-canvas-sync.md) ✅ DONE | Canvas lock while the assistant works, live updates on the builder | medium |
| [05-assistant-chat-ui.md](05-assistant-chat-ui.md) ✅ DONE | Ask button, draggable chat panel, history, uploads, model picker, progress view | large |
| [06-security-limits-and-tests.md](06-security-limits-and-tests.md) ✅ DONE (manual test pending) | Abuse limits, privacy rules, checks to write, manual test plan | medium |

Do 01 first (independent). Then 02 → 03 → 04 → 05. Apply 06 throughout; its checklist gates "done".

## Decisions already made by the product owner (do not re-ask)

1. **Canvas lock**: while the assistant is working on a workflow, the canvas is read-only for the user, with a Stop button. No merge logic.
2. **History**: one assistant chat history per **user**, across all workflows (each thread remembers which workflow it was about). **Memory** is per user.
3. **Model**: a model picker in the assistant chat (same catalog as bot chat). Assistant tokens **count toward the user's daily token budget**.
4. **Durable**: the assistant keeps working when the tab is closed or the browser is gone. It runs in Cloudflare (a Workflow, like bot chat). When the user comes back, the chat shows what happened and what it is doing now.
5. **No raw tool stream in the UI**: the chat shows only (a) the todo list as a collapsible progress row with ✅ / spinner per item and (b) the final answer. Never tool names, JSON arguments, or event logs.
6. **The canvas is the visible output**: every change the assistant makes is written to the workflow draft, and the open builder updates live, exactly like manual edits and manual test runs do today.
7. **Assistant tools include**: edit the workflow (as JSON), share with bots, JSON import/export, test runs ("Test this step" and full test), turn on / off.
8. **Ask a bot** gets a "Normal bot" choice (no persona/memory/apps, user picks the model) next to "One of my bots".
9. **Structured output**: users build the answer's shape in a form; the model must answer in exactly that shape.
10. **Every input field gets a placeholder with a real example.**

## Codebase orientation (read before coding)

Monorepo: `apps/backend` (Hono on Cloudflare Workers, Drizzle + Neon Postgres, LangChain / Deep Agents, Bun) and
`apps/web` (Next.js 16, React Compiler, Tailwind 4, shadcn/ui on Base UI, Zustand). Run `bun install`, `bun run dev`.

Key places:

| Area | Path |
|---|---|
| Workflow graph schema (zod, shared with web) | `apps/backend/src/modules/workflows/graph/schema.ts`, `blocks.ts`, `event-ai-blocks.ts` |
| Graph validation | `graph/validate.ts` (`publishIssues`, `runIssue`), `graph/structure.ts` |
| Portable JSON (export/import, strips private data) | `graph/portable.ts`, route `workflows/routes/import.ts` |
| Workflow store | `workflows/store/workflows.ts` (`saveDraft` with optimistic `expectedUpdatedAt`), `store/publish.ts`, `store/bot-access.ts` |
| Run engine | `workflows/engine/start.ts` (`startRun`), `runner.ts`, `walk.ts`, `execute-block.ts`, `blocks/ai.ts` |
| Live builder socket | `workflows/live/{events,publish,relay,token}.ts` (`WORKFLOW_LIVE` Durable Object, one per workflow) |
| Bot workflow tools (REUSE) | `apps/backend/src/modules/agent/workflows/*` (`create_workflow`, `update_workflow`, `run_workflow`, `turn_on_workflow`, `request_app_connections`, `toGraph`, `describeWorkflow`) |
| Block help text for models | `apps/backend/src/prompts/workflow-tools.ts` (`BLOCKS_HELP`, `TEMPLATES_HELP`) |
| Durable agent run pattern (COPY) | `apps/backend/src/modules/chat/run/workflow.ts` (`ChatRunWorkflow`: slices, checkpoints, `waitForEvent`), `chat/run/slice.ts`, `chat/relay/*` (`ChatRelay` DO, gap-free `seq`) |
| Deep Agent setup + todo middleware | `apps/backend/src/modules/agent/agent.ts` (`createDeepAgent`), `agent/middleware/todo-guard.ts` |
| Checkpointer (Postgres) | `apps/backend/src/modules/agent/checkpointer/*` |
| Models catalog | `apps/backend/src/modules/agent/models.ts` + `models.json`, route `GET /api/v1/models` |
| Memory | `apps/backend/src/modules/memory/*` |
| Files / uploads (R2) | `apps/backend/src/modules/files/*`, web `features/chat/hooks/use-attachments.ts` |
| Rate limits | `apps/backend/src/middleware/rate-limit.ts`, bindings in `apps/backend/wrangler.jsonc` |
| Builder UI | `apps/web/src/features/workflows/builder/*` (`workflow-builder.tsx`, `store.ts` = `useBuilder`, `top-bar/*`, `settings/*`, `template/*`) |
| Chat UI pieces (REUSE) | `apps/web/src/features/chat/components/agent-parts/todo-list.tsx`, `work-steps.tsx`, `components/ui/*`, `components/markdown` |

Conventions (match them):
- Comments explain *why*, in plain words. Short files, one concern each. No new dependency without a reason.
- Every route: `authGuard`, a rate limiter, zod `validate`, ownership check through the user id (never an id alone).
- Checks are plain `assert` scripts named `*.check.ts`, run with `bun run <file>`, listed in `apps/backend/package.json` (`check:*`).
- Type-check with `bunx tsc --noEmit` **inside each app** (`apps/backend`, `apps/web`). The root `bun run check-types` (turbo) can replay a cached success; do not trust it alone.
- Lint/format web with `bunx biome check --write <files>` (only files you touched).
- Migrations: edit `apps/backend/src/db/schema/*`, then `bun run --cwd apps/backend db:generate`; dev uses `db:push`.
- Never edit `apps/web/src/components/ui/*` (shadcn generated) except by `shadcn add`.
