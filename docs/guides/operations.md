# Deployment and operations

## Environments

| Piece | Local | Production |
|---|---|---|
| API | `wrangler dev` (:8787) | Cloudflare Worker `backend` |
| Web | `next dev` (:3000) | Any Next.js host (for example Vercel or Cloudflare) |
| Database | Neon branch | Neon main branch |
| Files | Local R2 emulation | R2 bucket `k4-bot-files` |

Use separate Neon databases and separate Composio projects per environment (Composio delivers events to one URL per
project).

## Deploying the API

```bash
cd apps/backend
bun run db:migrate                        # against the production database (DATABASE_URL_UNPOOLED)
bunx wrangler deploy
```

Set every secret once with `bunx wrangler secret put <NAME>` (never in `wrangler.jsonc`): `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `COMPOSIO_API_KEY`, `COMPOSIO_WEBHOOK_SECRET`,
`E2B_API_KEY`, `SECRETS_ENCRYPTION_KEY`, `RESEND_API_KEY`, `GOOGLE_CLIENT_SECRET`, `WS_TOKEN_SECRET`.

Plain variables go in `wrangler.jsonc` `vars` or the dashboard: `BETTER_AUTH_URL` (the API's public URL), `WEB_ORIGIN`
(the web app's URL), `COOKIE_DOMAIN` when web and API are sibling subdomains, and any limit you want to change.

The first deploy creates the Durable Object classes (migrations `v1`–`v5`), the three Workflows, the R2 binding, the
rate-limit namespaces and the two cron triggers declared in `wrangler.jsonc`. Create the R2 bucket beforehand:
`bunx wrangler r2 bucket create k4-bot-files`.

## Deploying the web app

Build with `NEXT_PUBLIC_AUTH_URL` set to the API's public URL, then deploy as a normal Next.js app.

## Composio event delivery

App-event triggers need Composio to reach the API. Once per environment:

```bash
cd apps/backend
bun run composio:webhook https://api.example.com
bunx wrangler secret put COMPOSIO_WEBHOOK_SECRET     # paste the secret the script printed (shown once)
```

The subscription delivers trigger messages and `composio.connected_account.expired`. Running the script again
rotates the secret: update the Worker secret right after.

## Rotating secrets

| Secret | How |
|---|---|
| `SECRETS_ENCRYPTION_KEY` | Put the current key in `SECRETS_ENCRYPTION_KEY_PREVIOUS`, a new one in `SECRETS_ENCRYPTION_KEY`; old values keep decrypting |
| `BETTER_AUTH_SECRET` | Rotating signs everyone out |
| `WS_TOKEN_SECRET` | Live sockets reconnect with new tokens |
| `COMPOSIO_WEBHOOK_SECRET` | Rerun `composio:webhook`, then update the Worker secret |
| A database password | Rotate in Neon, then update `DATABASE_URL` / `DATABASE_URL_UNPOOLED` everywhere |

## Scheduled jobs

| Cron | Job | If it stops |
|---|---|---|
| every minute | Due scheduled workflows and bot tasks | Schedules and tasks do not run |
| 03:00 UTC daily | Prune chat events (7 days) and Composio event ids, refresh the app catalog, pause stale sandboxes, fail stuck runs | Tables grow; the catalog ages; stuck runs stay "running" |

Locally, trigger them with `wrangler dev --test-scheduled` and `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`.

## Monitoring

- Worker logs and traces: Cloudflare dashboard (observability is enabled, full sampling). Log lines are prefixed by
  area: `[chat-run]`, `[workflow-run]`, `[composio]`, `[composio-events]`, `[schedule]`, `[tasks]`, `[computer]`, `[mail]`.
- Workflow instances (chat runs, background tasks, workflow runs): Cloudflare dashboard → Workflows.
- Costs to watch: OpenRouter (tokens), E2B (computer and sandbox minutes), Tavily, Composio, Mistral OCR. Each has a
  per-user daily cap ([Limits](../reference/limits.md)).

## Backups

Neon keeps point-in-time history. R2 objects are not versioned by default; enable bucket versioning if files must be
recoverable.
