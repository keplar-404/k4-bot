# K4 Bot

Create AI bots with a generated avatar and chat with them. Each bot is backed by a
[LangChain Deep Agent](https://docs.langchain.com/oss/javascript/deepagents/overview)
that can plan with todos, search the web, and write files (writes pause for your approval).

## Architecture

```
apps/
  web/       Next.js 16 (Cache Components, React Compiler), Tailwind 4, shadcn/ui
  backend/   Hono on a Cloudflare Worker
```

```
browser ──HTTP──▶ Worker (Hono) ──▶ ChatRunWorkflow ──▶ Deep Agent ──▶ OpenRouter
   ▲                  │                    │
   │                  │                    └─ checkpoints ─▶ Neon Postgres
   └──WebSocket── ChatRelay Durable Object ◀── events (gap-free seq, saved to Postgres)
```

- **Send:** `POST /api/v1/chat/threads/:id/messages` starts a durable workflow and returns `202`.
- **Stream:** the workflow publishes agent events to the thread's `ChatRelay` Durable Object, which
  numbers them, saves them, and broadcasts over a WebSocket. A client resumes from its last
  `seq`; if it is too far behind it reloads history over HTTP.
- **Approval:** a paused run publishes `run.waiting_approval`; `POST /chat/runs/:id/resume`
  continues it from the saved checkpoint.
- **Data:** Neon Postgres (Drizzle) holds users, bots, threads, messages, events, usage and agent checkpoints.

- **Cleanup:** a daily Cron Trigger (03:00 UTC) deletes stream events older than 7 days, keeping each
  thread's newest one. Messages and usage are kept.

Cloudflare services used: Workers, Durable Objects, Workflows, Rate Limiting, Cron Triggers.
Everything else is external: Neon, OpenRouter, Tavily (search), Resend (email), Better Auth.

## Run locally

Needs Node 24+ and Bun. No Cloudflare account is required for local development.

```sh
bun install
cp .env.example apps/backend/.dev.vars     # then fill it in
bun run --cwd apps/backend db:push         # create the tables
bun run dev                                # web :3000, API :8787
```

Without `RESEND_API_KEY`, verification and reset links are printed in the API log.

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string |
| `BETTER_AUTH_SECRET` | yes | 32+ chars; signs sessions |
| `BETTER_AUTH_URL` | yes | Public API URL |
| `WEB_ORIGIN` | yes | Web app URL (CORS, trusted origin) |
| `OPENROUTER_API_KEY` | yes | The agent's only model provider |
| `TAVILY_API_KEY` | no | Enables the web-search tool |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Google sign-in |
| `RESEND_API_KEY`, `MAIL_FROM` | no | Email delivery |
| `WS_TOKEN_SECRET` | no | 32+ chars; separate secret for socket tokens |
| `COOKIE_DOMAIN` | no | Share the session cookie across sibling subdomains (production) |
| `MAX_RUNS_PER_USER` | no | Messages per user per day (default 50) |
| `MAX_DAILY_TOKENS_PER_USER` | no | Token budget per user per day (default 2,000,000) |
| `RUN_TIMEOUT_SECONDS` | no | Agent step timeout (default 900) |
| `NEXT_PUBLIC_AUTH_URL` | web | API URL for the browser (default `http://localhost:8787`) |

Models are listed in `apps/backend/src/agent/models.json`. Free OpenRouter models are
rate-limited upstream and some are gated; paid models are the reliable choice.

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Web and API together |
| `bun run --cwd apps/backend agent:chat [modelId]` | Talk to the agent in the terminal (no web app or database) |
| `bun run check-types` | `tsc` for both apps |
| `bun run --cwd apps/backend check` | Relay-token and stream-parser checks |
| `bun run --cwd apps/web check:chat` | Chat reducer and outbox checks |
| `bun run --cwd apps/backend db:generate` / `db:migrate` / `db:push` | Drizzle migrations (`push` for dev) |

## Backend layout

```
src/
  agent/        Deep Agent factory, model catalog, checkpointer, middleware, tools, stream parser
  db/           Drizzle client and schema
  durable/      ChatRelay Durable Object
  lib/          env, auth, request context, schemas, shared helpers
  middleware/   auth guard, CORS, rate limits
  routes/       bots, models, auth, chat/{threads,runs,realtime}
  workflows/    ChatRunWorkflow
```
