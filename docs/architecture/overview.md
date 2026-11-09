# Architecture overview

## System diagram

```
                         ┌──────────────────────────── Browser ─────────────────────────────┐
                         │  Next.js web app (apps/web)                                      │
                         │  dashboard · chat · workflow builder · connect · files · tasks   │
                         └───────┬──────────────────────┬───────────────────────┬───────────┘
                     HTTPS (cookie session)     WebSockets (signed tokens)   iframe (noVNC, token in path)
                                 │                      │                       │
┌────────────────────────────────▼──────────────────────▼───────────────────────▼──────────────────────────┐
│ Cloudflare Worker "backend" (apps/backend) — Hono app at /api/v1                                         │
│                                                                                                          │
│  Middleware: CORS → secure headers → 1 MB body limit → per-IP rate limit → auth guard (per route)        │
│                                                                                                          │
│  Modules: auth · bots · chat · agent · files · computer · sandbox · integrations · composio · workflows  │
│           tasks · schedules · secrets · memory · async-tasks                                             │
│                                                                                                          │
│  Durable Objects            Workflows (durable execution)        Other bindings                          │
│  ├ ChatRelay (per thread)   ├ chat-run    (one per chat turn)    ├ R2 bucket FILES                        │
│  ├ UserComputer (per user)  ├ async-task  (background agents)    ├ 7 rate-limit namespaces               │
│  ├ BotSandbox (per bot)     └ workflow-run (one per workflow run)└ Cron: every minute + daily 03:00 UTC   │
│  ├ AsyncTaskRegistry (per thread)                                                                        │
│  └ WorkflowRunRelay (per workflow)                                                                       │
└──────┬─────────────────┬──────────────────┬───────────────────┬────────────────────┬────────────────────┘
       │                 │                  │                   │                    │
  Neon Postgres     OpenRouter          E2B                 Composio             Tavily · skills.sh ·
  (Drizzle, HTTP)   (all LLMs,          (desktop VMs and    (1,700+ apps:        MCP servers · Resend ·
  users, chats,     images, OCR)        code sandboxes)     OAuth, actions,      Google OAuth
  workflows, …                                              triggers/webhooks)
```

## Technology stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | Bun workspaces + Turborepo | One install, cached builds across `apps/*` |
| API | Hono on Cloudflare Workers | Fast edge runtime; Hono's typed routes give the web app end-to-end types (`AppType`) |
| Durable state | Durable Objects (SQLite storage) | One object per thread / user / bot / workflow: ordered events, sockets, per-entity state |
| Long-running work | Cloudflare Workflows | Chat runs and workflow runs survive deploys and restarts; waiting (approvals, sleeps) costs nothing |
| Database | Neon Postgres via Drizzle ORM (HTTP driver) | Relational data, migrations in `apps/backend/drizzle/` |
| Files | Cloudflare R2 | Uploads, generated images, files shared from the computer |
| Auth | Better Auth (email + password, Google OAuth, email verification via Resend) | Database sessions, cookie cache, built-in rate limits |
| AI agents | LangChain / LangGraph + Deep Agents (`deepagents`) | Tool-calling agents, middleware, checkpoints in Postgres |
| Models | OpenRouter | One key for many models (free and paid), image generation, OCR |
| Computers | E2B (desktop template and code sandboxes) | Real Linux VMs the bots drive |
| Connected apps | Composio | OAuth and actions for 1,700+ apps, plus app-event triggers |
| Web | Next.js 16 (App Router, Turbopack, Cache Components), React 19 | |
| UI | shadcn (style `base-vega`) on Base UI, Tailwind CSS, lucide icons, sonner toasts | |
| Client state | zustand | Small stores per feature |
| Workflow canvas | React Flow (`@xyflow/react` 12) | |

## How a request flows

1. The browser calls `https://<api>/api/v1/...` with the Better Auth session cookie (`credentials: "include"`).
2. `apps/backend/src/index.ts` applies CORS (only `WEB_ORIGIN`), secure headers, a 1 MB body limit and the per-IP limiter.
3. The module router (`src/routes.ts`) dispatches. Protected routers run `authGuard`, which loads the session.
4. The handler validates input with zod (`shared/validate.ts`), applies the per-user limiter where the action is
   expensive, and reads or writes only rows owned by the session user (someone else's id answers 404).
5. Long work is never done in the request: the handler starts a Workflow instance and answers `202`/`201` at once.
   Progress reaches the browser over a WebSocket served by a Durable Object.

## The three long-running engines

| Engine | Started by | Runs as | Streams to the browser through |
|---|---|---|---|
| Chat run | `POST /chat/threads/:id/messages`, a scheduled task | `ChatRunWorkflow` (sliced agent loop) | `ChatRelay` Durable Object (per thread) |
| Background task | the agent's `start_background_task` | `AsyncTaskWorkflow` | `ChatRelay` notice, `AsyncTaskRegistry` |
| Workflow run | Run button, schedule, webhook, app event, a bot | `WorkflowRunner` (one durable step per block) | `WorkflowRunRelay` Durable Object (per workflow) |

All three record cost (tokens, runs) in Postgres so daily caps hold even across deletes.

## How the products connect

```
             Connected apps (Composio, per user)
               ▲ app tools                     ▲ app action blocks / app-event triggers
  Bot (chat) ──┤                               │
   modes       ├── list / create / run ──────▶ Workflow ── HTTP block, secrets
   tasks       │◀───────── "Ask a bot" block ──┘
   computer    │
   sandbox     └── skills, MCP servers, files, memory
```

- A bot uses the same connected apps a workflow uses; access is per bot (the user picks which apps each bot may use).
- A bot can list, create, turn on and run workflows that are shared with it.
- A workflow's "Ask a bot" block hands one step to a bot (read-only tools, no workflow tools, so chains stay shallow).
- A bot can schedule its own tasks; each one comes back as a message in its chat.

Read next: [Backend](backend.md), [Web app](web.md), [Data model](data-model.md), [Security](security.md).
