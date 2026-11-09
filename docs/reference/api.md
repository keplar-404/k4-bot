# API reference

Base URL: `<API>/api/v1` (locally `http://localhost:8787/api/v1`). JSON in and out. Authentication is the Better Auth
session cookie (send with `credentials: "include"`) unless a route says otherwise.

Errors share one shape: `{ "error": "CODE", "message": "Readable text", ...details }`. Common codes: `INVALID_INPUT`
(400, with zod `details`), `401` (not signed in), `NOT_FOUND` (404, also for other users' ids), `RATE_LIMITED` / 429,
`QUOTA_EXCEEDED` (402), `NOT_READY` / `LIMIT` (409/422), `NOT_CONFIGURED` (503, a missing server key).

The web app gets these types directly from the backend (`AppType`), so this page is a map, not a contract.

## Health

| Method | Path | |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }`, no auth |

## Auth (`/auth/*`, Better Auth)

Sign up, sign in (email or Google), sign out, verify email, forgot / reset password, `GET /auth/get-session`. See
[Better Auth's API](https://better-auth.com/docs). Rate limited by Better Auth itself.

## Bots

| Method | Path | |
|---|---|---|
| GET | `/bots` | Your bots |
| GET | `/bots/domains` | Roles with their defaults and recommendations |
| GET | `/bots/:id` | One bot |
| POST | `/bots` | Create (name, avatar, role, capabilities, skills, MCP servers, apps) |
| POST | `/bots/admin` | Create the user's admin bot (returns the existing one if there is one) |
| PATCH | `/bots/:id` | Update |
| PUT | `/bots/:id/model` | Remember the chosen model and reasoning level |
| DELETE | `/bots/:id` | Delete (its chats go too; usage rows stay for the daily caps) |
| GET | `/models` | Selectable models |

## Chat (`/chat`)

| Method | Path | |
|---|---|---|
| GET | `/threads?botId=&groupId=&cursor=` | Threads, newest first (a bot's own, or a group's) |
| POST | `/threads` | New thread `{ botId \| groupId, title?, mode? }` |
| PUT | `/threads/:id/mode` | `{ mode: "ask" \| "plan" \| "allow_all" }` |
| GET | `/threads/:id/messages?before=&limit=` | History page, last event `seq`, pending approval/question, usage |
| POST | `/threads/:id/messages` | Send `{ content, messageId?, fileIds?, modelId?, reasoningEffort?, retry?, compact? }` → `202 { runId, userMessageId }` |
| POST | `/threads/:id/ws-token` | Token for the live socket |
| GET | `/threads/:id/ws?…` | Live socket (WebSocket) |
| POST | `/runs/:runId/resume` | Answer an approval or a question |
| POST | `/runs/:runId/stop` | Stop a run |

## Groups (`/groups`)

`GET /` (with members), `POST / { name, botIds, leadBotId? }`, `PATCH /:id { name?, botIds?, leadBotId?, memory? }`,
`DELETE /:id` (stops and deletes its chat).

## Memory (`/memory`)

`GET|PUT /preferences`, `GET|PUT /bots/:id` (one bot's memory). `POST /events/:id/undo` (undo an automatic update).

## Files (`/files`)

`GET /` (list, `?cursor=&botId=`), `GET /:id`, `GET /:id/content` (bytes), `POST /` (multipart upload), `DELETE /:id`.

## Computer (`/computer`)

| Method | Path | |
|---|---|---|
| GET | `/` | Status |
| POST | `/wake`, `/pause`, `/reset` | Power |
| GET, PUT | `/settings` | Computer settings |
| POST | `/session/wrap` | Wrap up the session |
| GET | `/snapshot` | Last saved screenshot |
| GET | `/accounts` | The bots' Linux accounts on the computer (sizes only while it runs) |
| POST | `/control/take`, `/control/keep`, `/control/release` | The mouse-and-keyboard lease |
| POST | `/ws-token`, then GET `/ws` | Status socket |
| POST | `/viewer` | Path of the live view for a mode |
| ALL | `/stream/:mode/:userId/:token/*` | noVNC proxy (token in the path, no cookie) |

## Sandboxes (`/sandbox`)

`GET /`, `GET /:botId`, `POST /:botId/start`, `POST /:botId/pause`, `DELETE /:botId`; editor: `POST /:botId/open`,
`GET /:botId/tree`, `GET /:botId/file`, `GET /:botId/ws`.

## Skills and MCP (`/integrations`)

`GET /skills`, `GET /skills/details`, `POST /skills`, `DELETE /skills/:id`; `GET /mcp`, `POST /mcp`,
`PUT /mcp/:id/secrets`, `POST /mcp/:id/test`, `DELETE /mcp/:id`.

## Connected apps (`/composio`)

| Method | Path | |
|---|---|---|
| GET | `/catalog?q=&category=&slugs=&withTriggers=1&offset=&limit=` | App catalog |
| GET | `/categories` | Categories with counts |
| GET | `/connections` | Your connected accounts |
| POST | `/authorize` | `{ toolkit, returnTo? }` → `{ redirectUrl }` |
| DELETE | `/connections/:id` | Disconnect |
| GET | `/toolkits/:toolkit/tools`, `/tools/:slug` | Actions and one action's schema |
| GET | `/toolkits/:toolkit/triggers`, `/triggers/:slug` | Events and one event's schema |
| POST | `/events` | **Composio only**: signed app events (no session) |

## Workflows (`/workflows`)

| Method | Path | |
|---|---|---|
| GET | `/` | List with stats and daily runs |
| POST | `/` | Create `{ name? }` |
| GET, PUT, DELETE | `/:id` | Read; save `{ name?, graph?, expectedUpdatedAt? }` (409 on conflict); delete |
| POST | `/:id/publish`, `/:id/pause` | Turn on (returns `webhookToken` once for webhook triggers) / off |
| POST | `/:id/webhook-token` | New webhook URL (the old one stops working) |
| GET, PUT | `/:id/bots` | Bots this workflow is shared with |
| POST | `/:id/run` | `{ mode: "test" \| "live", input?, until?, pins? }`; a manual trigger's form is checked (422 with what is missing) |
| GET | `/:id/runs`, `/runs/:runId` | Run list; one run with every step |
| GET | `/approvals` | Every waiting "Ask me first" across your workflows |
| GET | `/:id/hook-requests` | The last 50 calls to a webhook workflow |
| POST | `/runs/:runId/cancel` | Cancel |
| POST | `/runs/:runId/steps/:nodeId/answer` | Answer an "Ask me first" block `{ approved, note? }` |
| POST | `/:id/live-token`, then GET `/:id/live` | Live run socket |

### Public webhook

`POST /hooks/:id/:token` with `Content-Type: application/json` (≤ 256 KB) → `202 { runId }`. No session: the token is
the credential. Any failure before the token check is `404`.

## Secrets (`/secrets`)

`GET /`, `PUT /:name { value, label? }`, `DELETE /:name`.

## Tasks (`/tasks`)

| Method | Path | |
|---|---|---|
| GET | `/?botId=` | Your scheduled tasks |
| POST | `/` | `{ botId, title, prompt, schedule }` |
| PATCH | `/:id` | `{ title?, prompt?, schedule?, status? }` |
| POST | `/:id/run` | Run now → `{ threadId }` |
| DELETE | `/:id` | Delete |
