# K4 Bot

Create AI bots with a generated avatar and chat with them. Each bot is backed by a
[LangChain Deep Agent](https://docs.langchain.com/oss/javascript/deepagents/overview)
that can plan with todos, search the web, and use a real Linux computer (shell, files, a browser you can watch).

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
- **Long runs:** a run is a loop of durable *slices* (`RUN_SLICE_STEPS` graph steps each). The agent's state is
  checkpointed in Postgres, so the next slice resumes where it stopped. Waiting costs nothing: a question to the
  user (`ask_user`), an approval, or "come back in 3 days" (`wait_for`) is a Workflow `waitForEvent` / `sleep`
  (up to 7 days each), not a held connection.
- **Resume:** `POST /chat/runs/:id/resume` sends the user's answer (`{decisions}` or `{answer}`) to the waiting run.
  `GET /chat/threads/:id/messages` also returns the run's open question/approval/sleep, so a reload still shows it.
- **Everything the agent does is shown:** reasoning, every tool call with its input and result, and the answer are
  streamed as ordered *parts* (`agent.reasoning`, `tool.start`, `tool.end`, `agent.token`) and saved in
  `chat_message.parts`. The web app renders them with the AI Elements `trace` and `code-block` components.
- **Data:** Neon Postgres (Drizzle) holds users, bots, threads, messages, events, usage and agent checkpoints.

- **Cleanup:** a daily Cron Trigger (03:00 UTC) deletes stream events older than 7 days, keeping each
  thread's newest one. Messages and usage are kept.

Cloudflare services used: Workers, Durable Objects, Workflows, Rate Limiting, Cron Triggers.
Everything else is external: Neon, OpenRouter, Tavily (search), E2B (the computer), Resend (email), Better Auth.

## The computer

Each user has **one** [E2B](https://e2b.dev) desktop, shared by all of their bots. It is owned by a
`UserComputer` Durable Object (one per user) that knows whether it is awake, who holds the mouse, and how many
minutes were used today.

```
bot page ──WebSocket──▶ UserComputer DO ──▶ E2B desktop (private, no public URL)
   └─ iframe ──▶ Worker proxy (signed, 15 min path token) ──▶ noVNC on the VM
```

- **Bots do not interfere:** every bot is its own Linux user with a private home (shell and files), its own
  Chrome profile and window, and the screen/mouse/keyboard is one lease that a bot holds while it works.
- **Watch and take over:** the right side bar of the bot page shows a live preview, the activity feed and today's
  usage. Click the preview for the full screen. *Watch* is a read-only VNC server (the VM refuses input);
  *Take control* hands the mouse to you and tells the bots to wait.
- **Cost guards:** minutes-per-day cap, idle pause after `COMPUTER_IDLE_MINUTES`, per-run action cap, 90 actions
  per minute, paused VMs are not billed, and nothing starts the VM except a bot's first use or *Wake up*.
- **Abuse guards:** the VM is private (`allowPublicTraffic: false`) and reachable only through the authenticated
  proxy; egress to private ranges and cloud metadata is denied; URLs, key combos and typed secrets are checked in
  code; the agent's prompt treats screen/web text as data; card numbers and API keys are redacted by LangChain
  `piiMiddleware`; every route is behind login and a per-user rate limit.
- **Turn it off:** `COMPUTER_ENABLED=false`, or leave `E2B_API_KEY` empty (the bots then run without a computer).

Details for maintainers are in `.agents/skills/e2b-computer/SKILL.md`.

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
| `E2B_API_KEY` | no | Enables the computer. Without it bots have no computer |
| `COMPUTER_MAX_MINUTES_PER_DAY` | no | Computer time per user per UTC day (default 120) |
| `COMPUTER_IDLE_MINUTES` | no | Pause the computer after this many idle minutes (default 5) |
| `COMPUTER_MAX_ACTIONS_PER_RUN` | no | Mouse/keyboard actions per run (default 400) |
| `COMPUTER_ALLOWED_HOSTS` | no | Comma list; when set, the browser may only visit these hosts |
| `E2B_TEMPLATE` | no | E2B template (default `desktop`, 8 vCPU / 8 GiB; a smaller custom template costs less) |
| `RUN_SLICE_STEPS`, `MAX_RUN_SLICES` | no | Graph steps per slice (60) and slices per run (300) |
| `MAX_OUTPUT_TOKENS` | no | Cap on tokens per model reply (default 8192) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Google sign-in |
| `RESEND_API_KEY`, `MAIL_FROM` | no | Email delivery |
| `WS_TOKEN_SECRET` | no | 32+ chars; separate secret for socket tokens |
| `COOKIE_DOMAIN` | no | Share the session cookie across sibling subdomains (production) |
| `MAX_RUNS_PER_USER` | no | Messages per user per day (default 50) |
| `MAX_DAILY_TOKENS_PER_USER` | no | Token budget per user per day (default 2,000,000) |
| `RUN_TIMEOUT_SECONDS` | no | Agent step timeout (default 900) |
| `NEXT_PUBLIC_AUTH_URL` | web | API URL for the browser (default `http://localhost:8787`) |

Models are listed in `apps/backend/src/agent/models.json`. The only free option is
`openrouter/free`, which lets OpenRouter pick one of its free models per request. It is
rate-limited upstream, so paid models are the reliable choice.

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Web and API together |
| `bun run --cwd apps/backend agent:chat [modelId]` | Talk to the agent in the terminal (no web app or database) |
| `bun run check-types` | `tsc` for both apps |
| `bun run --cwd apps/backend check` | Relay-token and computer-guard checks |
| `bun run --cwd apps/web check:chat` | Chat reducer and outbox checks |
| `bun run --cwd apps/backend db:generate` / `db:migrate` / `db:push` | Drizzle migrations (`push` for dev) |

## Backend layout

```
src/
  agent/        Deep Agent factory, model catalog, checkpointer, tools, event-stream reader (run-stream)
  computer/     UserComputer Durable Object, sandbox backend, computer tools, guards
  db/           Drizzle client and schema
  durable/      ChatRelay Durable Object
  lib/          env, auth, request context, schemas, shared helpers
  middleware/   auth guard, CORS, rate limits
  routes/       bots, models, auth, computer, chat/{threads,runs,realtime}
  workflows/    ChatRunWorkflow
```
