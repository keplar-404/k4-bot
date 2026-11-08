# K4 Bot: handoff (start here)

Last update: 2026-11-07. Branch `development`; last commit `18c0f63`. **Everything from this task is uncommitted** (list in §6). Never commit `.env` or `.dev.vars`. Commit or push only when the user asks.

## Read in this order

| # | Doc | Why |
|---|---|---|
| 1 | this README | Goal, the user's decisions, status, order of work |
| 2 | `00-architecture.md` | **How the existing app works.** Read it before touching anything, so nothing breaks |
| 3 | `01-security.md` | The security rules every change must follow (zod, ownership, rate and cost limits, secrets, prompt injection) |
| 4 | `workflows/README.md`, then `01…09` | Workflow overview (done), builder (almost done), engine, real time, triggers |
| 5 | `agent-platform/README.md`, then `01…06` | The main goal: bots and workflows sharing connected apps |
| 6 | `connect/README.md` | Composio login and the Connect page (done) |

## 1. The product goal (the user's words)

> Users build their own custom workflows. They share a workflow with a bot so the bot can use it, or the bot creates workflows for the user. Bots use the user's connected apps. Just like Grok and Zapier: combine both platforms.

## 2. The user's decisions (final, do not re-ask)

| Topic | Decision |
|---|---|
| Retry | A per-block setting (max attempts, delay, backoff) |
| Limits | The limits in `01-security.md` §4 are accepted |
| Bots use connected apps | **Yes** |
| Bot's computer | Each bot already has its own PC: a Linux account, workspace and browser profile on the user's E2B desktop. **Do not touch the computer feature.** App tools run on the server, so they work alongside it with no change |
| Bots and workflows | A bot can **create a workflow and run it automatically** (subject to the permission mode below) |
| Secrets for workflows | When a workflow needs an API key or private info, the bot asks the user to enter it in a **secure form**. The value goes straight to the backend, is **encrypted in the DB**, and the bot only gets "saved as `NAME`". The engine uses it server-side at run time. **The value is never sent to the bot** (spec: `agent-platform/03`) |
| Human approval | **Yes.** Plus a **mode picker in the prompt bar**, like the model and reasoning pickers: **Allow all · Plan · Ask** (spec: `agent-platform/04`) |
| Allow all | The bot does the work without asking |
| Plan | The bot only plans and shows the plan. When it needs to act, it asks the user to switch mode with a **button in the chat**; clicking it changes the mode and updates the prompt bar |
| Ask | The bot asks before every action that changes something (the existing approval cards) |
| HTTP request block | **Yes**, build it, with the SSRF protections in `agent-platform/05` |
| Docs | The user wants SOLID, ≤100 lines per file, never trusting frontend data, and no spam or cost blow-ups possible, even by a bot |

Still open (ask in one message, but don't block on it): **"Ask a bot" workflow block** (a workflow hands a step to a bot). It was proposed and never confirmed; the spec is in `agent-platform/06`.

## 3. Status (updated 2026-11-08)

Verified by `tsc` (backend and web), `bun run check` (includes modes, engine, http-guard, http block, hooks route, action-kind), Biome on the touched web folders. **Not browser-tested and not run against a real Composio / Workflows runtime yet.**

| Area | State |
|---|---|
| Connect (Composio login, 1,723 apps), workflow CRUD / publish API, overview page | DONE |
| Builder `/workflows/[id]` | Run button, runs drawer, canvas overlay, run banner, "Bots" share dialog. Live updates over a WebSocket (`WorkflowRunRelay` Durable Object, one per workflow; owner-only signed token); polls every 2 s only after 3 failed connects. The web socket client is tested against the local backend; a visual browser check (light and dark) is still to do |
| Engine (`modules/workflows/engine`) | DONE: durable per-block steps, retry via `ctx.attempt`, continue-on-error, cancel, HTTP block, secrets + redaction, run caps (`start.ts`) |
| Triggers | Manual / test (`routes/runs.ts`), schedule (per-minute cron), webhook (`/api/v1/hooks/:id/:token`, rate limited, 256 KB, loop guard) |
| Permission modes | DONE: Allow all / Plan (allow-list, enforced in code) / Ask; mode saved server-side; switch applied by the resume route |
| Bots use apps | DONE: `app_find_actions`, `app_action_details`, `app_read` (reads only), `app_act`; bot form "Apps" section |
| Bots build / run workflows | DONE: `list_my_workflows`, `get_workflow`, `create_workflow`, `update_workflow`, `turn_on_workflow`, `pause_workflow`, `run_workflow`, `workflow_run_status`; sharing per workflow (`bot_workflow`) |
| Secrets vault | DONE: `/api/v1/secrets`, `/dashboard/secrets`, `request_secret` secure form in chat |
| Migration | `drizzle/0016_small_old_lace.sql` (idempotent). **Run `bun run db:migrate` before starting the backend**: `chat_thread.mode` is read by every chat |

Deliberate simplifications (not in the old specs): manual-trigger inputs are free-form (`{{trigger.inputs.x}}`), no declared-inputs editor; `run_workflow` always asks in Ask mode (no per-share switch); no workflow preview card in chat (the tool returns the `/workflows/<id>` link); "Ask a bot" block (unconfirmed) and Composio app-event triggers are not built.

## 4. Order of work

1. `workflows/02`: finish the file splits, then test the builder in the browser.
2. `agent-platform/04`: permission modes. Every later tool depends on them, so build them first.
3. `agent-platform/01`: bots use connected apps.
4. `workflows/04 → 03 → 06a → 05`: engine, manual/test runs, live view.
5. `agent-platform/03` (secrets vault and bot-authored workflows), then `02` (workflows as bot tools).
6. `workflows/06b, 06c`: schedule and webhook. `agent-platform/05`: HTTP block.
7. `workflows/08`: full test pass. Clean up test data (ask first), then ask about commit/push.

## 5. Repo rules

- **Monorepo, bun.**
  - `apps/backend`: Hono on Cloudflare Workers, Durable Objects, Workflows, Drizzle + Neon (HTTP driver), R2, rate-limit bindings.
  - `apps/web`: Next.js 16 (Turbopack), shadcn base-vega on **@base-ui** (`render={<Link/>}`, never `asChild`), Tailwind, zustand, `@xyflow/react` 12, sonner.
- **≤100 lines per file.** Exempt: `components/ui/*`, `lib/bloub/bot/*`, generated files. Feature folders: web `src/features/*`, backend `src/modules/*`. Pragmatic SRP only: no class hierarchies or value objects unless the module already uses them (the computer DO does).
- **Keep Hono route chaining.** The web gets its types from `AppType`. The web imports backend types through `@backend/...`.
- Comments explain *why*. Keep existing comments and guards.
- If `.codegraph/` exists, use `codegraph explore` before grep.
- **Commands:**
  - web: `bun run check-types`, `bunx biome check --write <paths>`;
  - backend: `bun run check-types`, `bun run check` (runs every `*.check.ts`), `bun run db:generate` then `db:migrate` (make migrations idempotent with `IF NOT EXISTS`).
- **Browser tests:** `mise exec node@26.7.0 -- agent-browser` with the `next-dev-loop` skill. Take screenshots and look at them, in light and dark.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## 6. Uncommitted work

- **Backend:**
  - `db/schema/{composio,workflow}.ts`; `auth.ts` (`composio_session_id`); `index.ts`;
  - migrations `0014`, `0015` + snapshots (already applied to the dev DB);
  - `modules/composio/*`, `modules/workflows/*`;
  - `routes.ts`, `scheduled.ts`, `config/env.ts`, `middleware/rate-limit.ts`, `wrangler.jsonc`, `package.json`;
  - `.env.example` (`COMPOSIO_API_KEY`).
- **Web:**
  - `components/layout/page-header.tsx`, `components/ui/select.tsx`;
  - `features/connect/*`, `features/workflows/*`, `app/workflows/*`;
  - the dashboard pages, `proxy.ts`;
  - deleted `app/dashboard/connect/platforms.ts`.
- `.commandcode/taste/taste/taste.md` is the user's own tooling: leave it alone.
- **Test data to clean up (ask first):** users `k4-e2e-*` and `k4-ui-*` (example.com) and their workflows, plus the Composio session for `probe-user-readonly`.

### End-to-end test (2026-11-08)

Run against `wrangler dev` with the real Neon database and OpenRouter (Claude Haiku 4.5):
- Workflows (53 checks): branching, templates through HTTP output, live socket events (two tabs), cross-user 404s and
  forged/foreign socket tokens refused, 503 retried then failed, 404 fails at once, continue-on-error, secrets redacted
  everywhere and encrypted at rest, metadata address and own API refused, durable delay with `resumeAt`, cancel during a
  delay, webhook (token once, wrong token 404, self-loop 409, paused 404), schedule started once by two overlapping crons,
  loops and unfinished blocks refused, delete closes open builder sockets (4404).
- Bot (16 checks): Plan mode creates nothing and asks to switch; after the switch (Ask) the draft is created and turning it
  on waits for approval; Ask asks before `run_workflow`, Allow all does not; the run is attributed to the bot;
  `request_secret` uses the secure form, a forged "saved" is not believed, the value never reaches chat events or messages.
- Found and fixed by these runs: every Ask / Allow all chat failed (duplicate `HideToolsMiddleware`; now a check in
  `modes.check.ts`); the cron claim compared timestamps exactly and could miss a due workflow; the web build failed on
  `/workflows/[id]` (`useParams` outside Suspense with Cache Components).
- Local dev needs `SECRETS_ENCRYPTION_KEY` (now in `.env.example`); without it saving a secret answers 503.
