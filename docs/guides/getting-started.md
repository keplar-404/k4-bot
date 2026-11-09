# Getting started

Run the whole platform on your machine: the API on `http://localhost:8787` and the web app on `http://localhost:3000`.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Bun | 1.3.x | Package manager and script runner (`devEngines` in the root `package.json`) |
| Node.js | ≥ 24 | Next.js and some CLIs |
| A Neon Postgres database | | Or any Postgres reachable over Neon's HTTP driver |
| Accounts for the services you want | | OpenRouter (required for bots), and optionally Tavily, Composio, E2B, Resend, Google OAuth |

Wrangler (Cloudflare's CLI) is installed as a dev dependency; `wrangler dev` runs Durable Objects, Workflows, R2 and
rate limits locally, with no Cloudflare account needed for development.

## 1. Install

```bash
git clone <repo> k4-bot && cd k4-bot
git checkout development
bun install            # at the repository root: installs both apps
```

## 2. Configure

Secrets are **not** in git. Create two files:

**`apps/backend/.dev.vars`** (read by `wrangler dev`; it must be in `apps/backend`, not the repository root). Start from
the root `.env.example`:

```bash
cp .env.example apps/backend/.dev.vars    # then fill in the values and delete the frontend line at the bottom
```

Minimum to sign in and chat:

| Variable | How to get it |
|---|---|
| `DATABASE_URL` | Neon connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string (used by migrations) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:8787` |
| `WEB_ORIGIN` | `http://localhost:3000` |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys |

Add these to switch features on (each one is optional; without it, that feature says it is not set up):

| Variable | Turns on |
|---|---|
| `TAVILY_API_KEY` | Web search and `/deep-research` |
| `COMPOSIO_API_KEY` | Connected apps, app blocks, app events |
| `COMPOSIO_WEBHOOK_SECRET` | Receiving app events (see [Operations](operations.md#composio-event-delivery)) |
| `E2B_API_KEY` | The computer and code sandboxes |
| `SECRETS_ENCRYPTION_KEY` | The secrets vault and MCP tokens (`openssl rand -base64 32`). **Use the same value on every machine that shares a database**, or saved secrets will not decrypt |
| `RESEND_API_KEY`, `MAIL_FROM` | Verification and password-reset emails (without them, links are logged to the console) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Sign in with Google" |

Every variable, with defaults: [Configuration](../reference/configuration.md). Each name must appear **once**; a
duplicate line makes one value silently win.

**`apps/web/.env.local`** (optional locally):

```bash
NEXT_PUBLIC_AUTH_URL=http://localhost:8787
```

## 3. Create the database tables

```bash
cd apps/backend
bun run db:migrate
```

Run this again whenever you pull new migrations (`apps/backend/drizzle/`). If two machines share one database, only
one needs to run it.

## 4. Run

```bash
bun run dev            # at the repository root: starts both apps with Turborepo
```

Or separately: `cd apps/backend && bun run dev` and `cd apps/web && bun run dev`.

Open `http://localhost:3000`, sign up, and verify your email (the link is printed in the backend console when Resend
is not configured).

## 5. Check that it works

```bash
curl http://localhost:8787/api/v1/health          # {"status":"ok"}
cd apps/backend && bun run check-types && bun run check
cd apps/web && bun run check-types
```

## Receiving app events locally

Composio cannot reach `localhost`. To test App event triggers on your machine, expose the API with a tunnel (for
example `cloudflared tunnel --url http://localhost:8787`), then point the project's subscription at it once:

```bash
cd apps/backend
bun run composio:webhook https://<your-tunnel-host>
```

Put the secret it prints in `.dev.vars` as `COMPOSIO_WEBHOOK_SECRET` and restart the backend. The subscription is per
Composio project, so this also redirects events away from any other environment using the same project: use a separate
Composio project (and key) for production.

Next: [Development guide](development.md) · [Troubleshooting](troubleshooting.md)
