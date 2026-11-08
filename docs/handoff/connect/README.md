# Connect (Composio) — status and follow-ups

The file-by-file reference is in `../workflows/01-what-exists.md` §B. This page records **how it works, what was verified, and what is still open**.

## 1. How per-user login works (verified correct)

- Composio's documented pattern is **one session per user**, with our user id as Composio's `userId`. `modules/composio/session.ts → userSession()` creates the session on first use (`composio.create(userId, {manageConnections:false})`), stores `user.composio_session_id`, resumes it later with `composio.use(sid)`, and recreates it if Composio lost it.
- Connect flow:
  1. The web calls `POST /api/v1/composio/authorize {toolkit}`.
  2. The server calls `session.authorize(toolkit, {callbackUrl: connectCallback(WEB_ORIGIN, toolkit)})` and returns the Composio Connect Link URL.
  3. The browser goes to Composio; the user logs in to *their own* account.
  4. Composio redirects to `/dashboard/connect?connected=<toolkit>`; `use-connect-return.ts` shows a toast and refetches.
- Connections are always listed with `connectedAccounts.list({userIds:[userId]})`, so a user only ever sees their own. Disconnect checks ownership (`ownConnection`) before `connectedAccounts.delete`.
- `manageConnections:false`: in-chat "please connect X" prompts are off, so the Connect page is the single place to connect apps.

## 2. Security / spam review (done; tests passed)

| Risk | Mitigation | Test |
|---|---|---|
| Open redirect via `callbackUrl` | The server builds the callback URL itself; the client value is ignored | Injected `callbackUrl=https://evil` → ignored |
| Connecting a fake app slug | `TOOLKIT_SLUG` regex + `isKnownToolkit` (must be in the cached catalog) | Bad slug → 400, unknown → 404 |
| Deleting someone else's connection | `ownConnection(userId, id)` → 404 | Cross-user delete → 404 |
| Spamming authorize/list | `userLimit` (20/min/user) on authorize, connections and disconnect | 21st call → 429 |
| Leaking tokens | Only display fields (id, toolkit, status, createdAt, account label) are returned; never auth config or tokens | Response inspected |
| Catalog hammering Composio | Catalog cached in Postgres (`composio_toolkit`), refreshed daily by cron or when older than the max age; search runs on our DB | 1,723 apps; page query ~185 ms |
| Key missing | `ComposioNotConfigured` → 503 with a friendly message | — |

## 3. Connect page UI (done; tested light, dark, mobile)

- A list (not cards) of all 1,723 apps, sorted by Composio usage, with infinite scroll.
- Toolbar: search (debounced), a category `Select` (labels via `category-label.ts`, so "CRM" and "AI agents" read correctly), and a status filter (All / Connected).
- Each row: the real logo (`https://logos.composio.dev/api/<slug>` on a white tile, an initial as fallback), name, description, categories, then **Connect**, or a **Connected** button with a menu → Disconnect (confirmation dialog).
- Empty and error states, plus a loading skeleton.

## 4. Small follow-ups (nice to have, not requested)

- [ ] `features/connect/components/connect-toolbar.tsx` is 103 lines: split out `status-filter.tsx` (the 100-line rule).
- [ ] Several accounts for the same app: the UI shows each connection, but test connecting a 2nd Gmail account (the workflow app block must let the user pick one; see `workflows/03`).
- [ ] Expired or failed connections (status `EXPIRED`/`FAILED`) show a "Reconnect" action.
- [ ] Apps with `no_auth: true`: show "No login needed" instead of Connect.

## 5. Let chat bots use connected apps: CONFIRMED by the user

**The full, current spec is `../agent-platform/01-bot-app-tools.md`; follow that one.** The older sketch below is kept for context only.

Not built. Today bots get tools from MCP apps (`modules/integrations`, `botApps` / `connectApps` in `modules/agent/tools/subagents/run-group.ts`) and from Tavily/web tools (`modules/agent/tools/web`). Plan:

1. **Per-bot opt-in**:
   - store `bot.composioToolkits: string[]` (a new jsonb column plus a migration) in the bot form's capabilities section. Read the `domain-bots` skill first; it describes how bot capabilities and tools are added;
   - only toolkits the **bot owner** has an ACTIVE connection for can be chosen.
2. **Tools**: in the agent build (`modules/agent/agent.ts → buildAgent`), when the bot has toolkits:
   - load the tools with `composio.tools.get(userId, {toolkits, limit})`, or the session's tool router (`session.tools()`). Check the `composio` skill and the AI SDK provider (`@composio/vercel` or the core `tools.get` with the AI SDK provider) for the exact call;
   - cap the number of tools per run (e.g. 40), because large toolsets hurt the model.
3. **Safety**:
   - write actions (send, delete, post) need a confirmation step in chat (human in the loop), or at least a clear visible tool call;
   - execute only as the bot's owner;
   - a per-user rate limit on Composio executions (a new binding, e.g. 30/min).
4. UI: show Composio tool calls in the chat with the app logo.
5. Test: a bot with Gmail enabled → "list my last 3 emails" → a real result. A bot without it can't.

## Logos and per-app settings: how they work (do not switch to the `logo_dev` toolkit)
- **Logos:** `https://logos.composio.dev/api/<slug>`, keyless, covers all catalog apps. Do **not** use Composio's `logo_dev` toolkit: it needs its own Logo.dev key (`token`) and a connected account, and its real tools are `LOGO_DEV_GET_LOGO_IMAGE`, `LOGO_DEV_SEARCH_BRAND`, etc. (an AI answer that mentions `LOGO_DEV_GET_LOGO` returning `logo_url`/`company_name` is wrong; checked against https://docs.composio.dev/toolkits/logo_dev).
- **"What settings does this app's action need":** `GET /composio/toolkits/:toolkit/tools` (the actions) and `GET /composio/tools/:slug` (input/output JSON Schema + pinned version), both cached 1 h. The builder's settings panel renders the form from that schema (`builder/settings/schema-form.tsx`). Bots get the same data through `app_find_actions` / `app_action_details` (`../agent-platform/01`).
