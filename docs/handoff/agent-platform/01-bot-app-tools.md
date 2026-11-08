# A — Bots use the user's connected apps (Composio)

## How bots get tools today (read this code first)
- `modules/agent/agent.ts → buildAgent(options)` assembles the tools: web (Tavily), sub-agents, computer, files, features, and `options.apps.tools`. It merges `options.apps.approvals` into the human-in-the-loop approvals (`InterruptOnConfig` per **tool name**).
- MCP apps: `modules/agent/mcp/connect.ts → connectBotApps(env, db, userId, botId)` reads `bot_mcp_server ⨝ user_mcp_server`, decrypts the secrets for this run only, and returns `BotApps {tools, approvals, names, unavailable, readOnly, close}`. Tools matching `entry.approval` regex need approval; read-only tools can go to sub-agents.
- The chat run passes `apps` into `buildRunAgent` (`modules/chat/run/agent.ts`). Search for where `connectBotApps` is called in `modules/chat/run/*`.
- Bot form (web): `features/bots/components/avatar-create-dialog/*`. The skills and MCP apps are picked there (`skillIds`, `mcpServerIds` in `use-bot-form.ts`, `useIntegrations()`).
- Read the project skill **`domain-bots`** before changing bot capabilities.

## Design: two generic tools, not 1,723 × N tool schemas

Loading every action schema of every app would blow the context: GitHub alone is about 5 MB. Instead, give the bot **four small tools** that our server implements with Composio. This is the "tool router" pattern (Composio's own meta-tools work the same way):

| Tool | Approval | What it does |
|---|---|---|
| `app_find_actions({app, query})` | no | Searches the actions of an app the bot may use. Uses `listTools` from `modules/composio/tools.ts` (already cached). Returns ≤15 `{slug, name, description}`. |
| `app_action_details({action})` | no | Returns the input schema (trimmed: required fields, types, enums, short descriptions; ≤8 KB) using `getTool`. |
| `app_read({action, arguments})` | **no** | Runs a **read-only** action. The server **refuses** any slug classified as a write (below) and tells the bot to use `app_act`. |
| `app_act({action, arguments, summary})` | **Ask:** approval card (static `interruptOn` entry). **Allow all:** none. **Plan:** hidden and refused (`04`) | Runs any allowed action after the user approves. `summary` is a one-line human description shown in the approval card ("Send email to bob@x.com: 'Invoice'"). |

The approval on `app_act` is a static `interruptOn` entry, added or removed by `approvalsFor(mode, …)` (`04-permission-modes.md`), so no new interrupt mechanism is needed.

**Read/write classification** (`modules/composio/action-kind.ts`, pure, with `action-kind.check.ts` added to `bun run check`):
1. **Composio's own tags first.** Tools carry hint tags (`readOnlyHint`, `createHint`, `updateHint`, `destructiveHint`; see https://docs.composio.dev/docs/configuring-sessions). Read them from the raw tool (`getRawComposioToolBySlug`; check the field name in `@composio/core` 0.28, likely `tags`) and cache them with `getTool`. `readOnlyHint` and none of the others → read; anything else → write.
2. Fallback when there are no tags: the slug verb after the toolkit prefix. Read if it matches `/^(GET|LIST|SEARCH|FIND|FETCH|READ|RETRIEVE|QUERY|DESCRIBE|COUNT|CHECK|LOOKUP|VIEW|EXPORT)_/`.
3. **Unknown → write.** Being wrong in the safe direction only costs one approval click.

**Execution** (`modules/composio/execute.ts`, **shared with the workflow engine**, `../workflows/03`). Implement it once:
```ts
executeAction(env, db, { userId, toolkit, slug, version?, arguments, connectedAccountId? })
// 1. slug ∈ toolkit (prefix check + getTool); toolkit allowed for this caller (checked by the caller)
// 2. connection: the given one must be the user's + ACTIVE, else the user's single ACTIVE one for the toolkit,
//    else error "Connect <App> on the Connect page" / "Choose which <App> account"
// 3. version: a pinned one (workflows) or the tool's current version from getTool (bots)
// 4. composio.tools.execute(slug, { userId, connectedAccountId, arguments, version })
// 5. result: trim to ≤16 KB of text for the model (keep the structure; mark truncated); never include auth data
```
Check the real `tools.execute` signature in `node_modules/@composio/core` and with the `composio` skill.

## Which apps a bot may use

New table `bot_composio_app` (`db/schema/composio.ts`; migration via drizzle-kit, made idempotent):
```
bot_id text FK bot(id) on delete cascade,
toolkit text not null,
connected_account_id text null,    -- null = the user's default (only) account for that app
allow_writes boolean not null default true,   -- false = read-only for this bot
created_at timestamp default now(),
primary key (bot_id, toolkit)
```
- Bot form: a new section, **"Apps"**, listing the user's ACTIVE Composio connections (from `GET /composio/connections`) with logos (reuse `features/connect/components/app-logo.tsx`). Each has a checkbox and a "Can send / change things" switch (`allow_writes`). Add a link "Connect more apps →" to `/dashboard/connect`.
- Backend: the bot create/update routes accept `composioApps: [{toolkit, connectedAccountId?, allowWrites}]` (max 30). Validate that each toolkit is connected by **this user**.
- Prompt: add to the system prompt the list of apps (names) plus one line on how to use the four tools: find → details → read/act. Also the untrusted-content line from the README.

## Session settings
In `modules/composio/session.ts` `userSession`, create sessions with `{ manageConnections: false, sandbox: { enable: false } }`. Composio's remote bash/workbench meta-tools must never exist for our users. Execution goes through `composio.tools.execute`, not the session's meta-tools.

## Wiring
- `modules/agent/composio/` (new): `bot-apps.ts` (load the rows; return the allowed toolkits + flags), `tools.ts` (the four LangChain `tool()`s; follow the style of `modules/computer/tools/screen.ts`). They return `{tools, approvals: {app_act: {allowedDecisions: ["approve","reject"], description: "Use an app"}}, names}`.
- Merge them into `options.apps` (or a new `options.composio`) in the chat run. Sub-agents: give them only `app_find_actions`, `app_action_details`, `app_read` (no writes, the same rule as the MCP `readOnly`).
- Per-user rate limit: a new binding `RL_APP_EXEC` (namespace 1006, 30/min), checked inside `executeAction` for bot calls (key `userId`). A 429 becomes a tool error text "Slow down: app limit reached, try again in a minute."
- Usage log (optional, recommended): a table `app_action_log (user_id, bot_id|workflow_id, toolkit, slug, ok, created_at)` for an "Activity" view later.

## Chat UI
- Tool-call parts already render in chat. Add an app look: logo + "Gmail · Send email" + collapsible arguments/result. Find the tool part renderer in `features/chat` (search for how `tavily_search` parts render).
- Approval card for `app_act`: show `summary`, the app logo, and the arguments as readable key/values. Approve / Reject (this exists for MCP approvals; reuse it).

## Done when
- Bot with Gmail: "what are my last 3 emails?" → `app_find_actions` → `app_read` → a correct answer, with no approval.
- "Reply 'thanks' to the first one" → an approval card → Approve → sent. Reject → the bot says it didn't send.
- `app_read` with a send slug → refused with a pointer to `app_act`.
- A bot without Gmail access, or with `allow_writes=false`, is refused cleanly.
- Another user's connection id → refused.
