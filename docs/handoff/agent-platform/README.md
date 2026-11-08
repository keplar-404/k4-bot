# Agent platform: bots × apps × workflows (the main goal)

One platform where chat bots (Grok-style) and automations (Zapier/n8n-style) share the user's Composio-connected apps and use each other. Read `../00-architecture.md` and `../01-security.md` first.

| # | Spec | What |
|---|---|---|
| 01 | `01-bot-app-tools.md` | Bots use the user's connected apps (four small server-side tools) |
| 02 | `02-workflows-as-bot-tools.md` | Share a workflow with a bot; the bot runs it |
| 03 | `03-bot-builds-workflows.md` | The bot creates, turns on and runs workflows, plus the **secrets vault** (the user enters keys in a secure form; the bot never sees them) |
| 04 | `04-permission-modes.md` | **Allow all · Plan · Ask** picker in the prompt bar, plus the in-chat "Switch mode" button |
| 05 | `05-http-request-block.md` | The workflow HTTP request block (approved), with SSRF protection |
| 06 | `06-ask-a-bot-block.md` | **Not confirmed:** a workflow step that hands a task to a bot. Ask the user before building |

The bot's computer: **unchanged and untouched.** Each bot already has its own PC (its own Linux account, workspace and browser on the user's E2B desktop). App tools run on the server and work in any run. To move a file between an app and the computer, the bot uses the existing `copy_to_computer` / `share_file` tools with the Files store.

```
          Connected apps (Composio, per user: Gmail, Slack, … 1,723)
              ▲ app tools (01)              ▲ action blocks (workflows/03)
 Bot (chat) ──┤                             │
   modes (04) │── run / create (02, 03) ──▶ Workflow ── HTTP block (05)
              │◀──────── "Ask a bot" (06, unconfirmed) ──
```

Shared principles:
1. One source of truth for connections and secrets: the server.
2. Mode controls *asking*; permissions control *access*; caps control *cost*. All three always apply.
3. Everything is user-scoped and validated with zod (`../01-security.md`).
4. Depth ≤2 for bot ↔ workflow chains.
