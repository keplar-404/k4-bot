# Connected apps (Composio)

[Composio](https://composio.dev) handles login (OAuth, API keys) and actions for 1,700+ apps: Gmail, Slack, GitHub,
Notion, Google Sheets, Supabase, HubSpot and more. One `COMPOSIO_API_KEY` serves every user; each user's connections
are stored at Composio under their user id. Without the key, the Connect page and app blocks answer
"Connected apps are not set up on this server."

## The catalog

The cron copies Composio's toolkit list into `composio_toolkit` once a day (name, logo, categories, action and event
counts, popularity). The Connect page and the builder search it with one query instead of calling Composio.
Logos come from `https://logos.composio.dev/api/<slug>`.

## Connecting an app

1. `POST /composio/authorize { toolkit, returnTo? }` creates a Composio connect link (the user's own session).
2. The browser goes to the app's login page; Composio then sends it back to the web app at `returnTo` with
   `?connected=<app>` (the page shows a toast). The callback URL is built on the server from `WEB_ORIGIN`, and only
   paths under `/workflows` or `/dashboard` are accepted, so the link cannot send users to another site.
3. `GET /composio/connections` lists the user's accounts live (status `ACTIVE`, `EXPIRED`, `FAILED`…); expired ones
   show **Reconnect**. `DELETE /composio/connections/:id` disconnects.

A user may connect several accounts of one app; blocks and bots then say which one to use.

## Where app data comes from

Nothing about an app is hand-written. Actions, inputs (with descriptions, types, defaults, examples), outputs and
events come from Composio's API, the same data that generates [docs.composio.dev/toolkits](https://docs.composio.dev/toolkits):

| Route | Data |
|---|---|
| `GET /composio/toolkits/:toolkit/tools` | The app's actions |
| `GET /composio/tools/:slug` | One action's input and output JSON Schema and version (cached 1 h) |
| `GET /composio/toolkits/:toolkit/triggers`, `GET /composio/triggers/:slug` | Events, their settings and what they send |

## Running an action (`composio/execute.ts`)

The one code path for bots and workflow blocks:

1. Per-user rate limit (`RL_APP_EXEC`, 30/min).
2. The action must belong to the app the caller names.
3. The version is pinned (Composio refuses "latest" for direct execution).
4. Arguments are **fitted** to the action's schema (`arguments.ts`): text from templates becomes the declared number,
   yes/no or list; empty optional fields are dropped; missing required fields are named before the call.
5. The account must be the user's own and `ACTIVE`.
6. Results are clipped; errors a retry cannot fix (bad input, permission) are marked fatal.

Files: inputs marked `file_uploadable` take a file from the user's Files page. The SDK cannot upload from Workers, so
`composio/files.ts` asks Composio for an upload URL, PUTs the bytes, and passes `{name, mimetype, s3key}`.

## Bots and apps

On the bot form the user chooses which apps a bot may use, which account, and whether it may write. The bot gets
`app_find_actions`, `app_action_details`, `app_find_events`, `app_read` and `app_act` (see [Agent tools](agent-tools.md)).

## App events (triggers)

Used by the workflow trigger "App event" (see [Workflows](workflows.md#app-events)):

- Turning a workflow on creates a Composio trigger instance on the user's own account (`composio/triggers.ts`);
  turning it off or deleting it removes it (unless another active workflow shares the same instance).
- Composio delivers every event for the whole project to **one** URL, `POST /api/v1/composio/events`, signed with the
  subscription secret. Set it up once per environment (see [Operations](../guides/operations.md#composio-event-delivery)).
- `composio.connected_account.expired` events turn off the workflows that use that app and account, with the reason shown.
- Gmail and other polling apps are checked every few minutes (at least 2 on Composio's managed auth); the first check only
  sets a baseline, so mail that arrived before the workflow was turned on never starts runs.

## Custom apps and triggers

Composio has an experimental way to define your own actions, but none for your own triggers. To reach a service
Composio lacks, use the workflow **Webhook** trigger (it calls you) and the **HTTP request** block (you call it).
