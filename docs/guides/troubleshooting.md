# Troubleshooting

## "Connected apps are not set up on this server."

The backend has no `COMPOSIO_API_KEY`. Add it to `apps/backend/.dev.vars` (in `apps/backend`, not the repository root)
and restart `bun run dev`. Secrets are git-ignored, so a fresh clone never has them.

Same pattern for the other "… is not set up on this server" messages: secrets → `SECRETS_ENCRYPTION_KEY`; AI steps →
`OPENROUTER_API_KEY`; file storage → the `FILES` R2 binding.

## It works on one machine and not on another

1. `apps/backend/.dev.vars` exists on the new machine, in `apps/backend`, with every variable (compare names, not values).
2. Each variable appears **once**. A duplicated `SECRETS_ENCRYPTION_KEY` with different values makes secrets saved on
   one machine fail to decrypt on the other.
3. `bun install` ran at the repository root after pulling.
4. The database has the latest migrations (`cd apps/backend && bun run db:migrate`).
5. `apps/web/.env.local` points at the right API (`NEXT_PUBLIC_AUTH_URL`) if it is not `http://localhost:8787`.
6. The backend console shows no startup error from the environment check (`config/env.ts` lists the bad variable).

## An app event never starts my workflow

Check in this order:

1. **The workflow is On.** App events reach only workflows that are turned on (the badge says On, not Off).
2. **The app is connected** with an `ACTIVE` account on the Connect page. Turning on fails with "Connect X first" if not.
3. **Composio can reach the API.** It cannot reach `localhost`: see
   [Receiving app events locally](getting-started.md#receiving-app-events-locally) or [Operations](operations.md#composio-event-delivery).
4. **`COMPOSIO_WEBHOOK_SECRET`** is set to the subscription's secret. Without it every event is refused (503); with the
   wrong one, 401 (look for `INVALID_SIGNATURE` in the logs).
5. **Polling apps are slow and start from now.** Gmail and similar apps are checked every few minutes, and the first
   check only records where to start: mail received before the workflow was turned on never triggers it.
6. The run history (Runs) shows a failed or skipped run with the reason (daily limit, turned off because of a loop or
   an expired connection).

## "You're offline" keeps showing

The chat shows this when its live connection to the API fails, usually because the backend is not running or not
reachable at `NEXT_PUBLIC_AUTH_URL`. Start the backend; the toast clears when the connection comes back, and it is
removed when you leave the chat. Errors such as being signed out or a chat that no longer exists show their own message
instead.

## The computer screen stays on "Connecting to the screen…"

- The computer must be awake: wake it from the panel. If E2B paused it on its own (its time ran out), the panel now
  switches to the asleep card with a wake button.
- `E2B_API_KEY` must be valid and the daily computer time not used up (`COMPUTER_MAX_MINUTES_PER_DAY`).
- `WEB_ORIGIN` must be exactly the web app's origin: the screen may only be framed by that origin.

## A bot replies with an error about the API key

OpenRouter answered "API key expired" or "invalid": create a new key at openrouter.ai and update `OPENROUTER_API_KEY`.

## Saving a secret answers 503

`SECRETS_ENCRYPTION_KEY` is missing. Generate one with `openssl rand -base64 32`.

## A scheduled workflow or task did not run

The per-minute cron must be running (in production it is automatic; locally `wrangler dev` runs it). A run that hits a
limit is recorded as skipped with the reason (run history for workflows, the task's last problem for tasks). A "once"
schedule turns itself off after it runs.

## Migrations fail with "already exists"

The database has a table the migration history does not know about (for example from an older feature). Inspect it
before changing anything; never drop a table you have not checked is unused and empty.
