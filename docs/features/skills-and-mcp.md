# Skills and MCP apps

Two ways to give bots extra know-how and tools, managed on `/dashboard/skills` and `/dashboard/mcp` and enabled per bot.

## Skills

A skill is a folder with a `SKILL.md` (instructions plus optional scripts and references), in the
[skills.sh](https://skills.sh) format.

| Step | How |
|---|---|
| Catalog | A curated list in `modules/integrations/catalog/skills.ts` (ids `owner/repo/skill`); each role recommends some |
| Install | `POST /integrations/skills`: the server downloads the skill's files from skills.sh, checks them (≤ 3 MB, ≤ 300 files, safe relative paths) and stores a pinned snapshot in R2, content-addressed so users who install the same version share one object |
| Updates | skills.sh reports a content hash; a different hash means an update is available |
| Use | Bots that have the skill get it through Deep Agents' skills middleware: the model sees the name and description, and reads the files when it decides the skill applies. With a computer, skills are also copied into the bot's home |

## MCP servers

[Model Context Protocol](https://modelcontextprotocol.io) servers give bots tools from other services.

| Step | How |
|---|---|
| Catalog | `modules/integrations/catalog/mcp.ts`: each entry has a name, description, capabilities, URL or built-in handler, and the secret fields it needs (for example Airtable's token). `shadcn` is served by this platform itself (the official server runs only locally) |
| Connect | `POST /integrations/mcp`, then `PUT /integrations/mcp/:id/secrets`. Secrets are encrypted with AES-256-GCM; the UI shows only the last characters |
| Test | `POST /integrations/mcp/:id/test` connects and lists the tools |
| Use | Bots allowed to use the server get its tools at run time (`modules/agent/mcp/`). Read-only tools stay available in Plan mode; others follow the mode rules |

## Connected apps vs MCP vs skills

| | Connected apps (Composio) | MCP servers | Skills |
|---|---|---|---|
| What | 1,700+ apps with OAuth handled by Composio | Specific services with their own MCP endpoint | Instructions and scripts |
| Login | OAuth per user (Connect page) | A token the user pastes | None |
| Used by | Bots and workflows | Bots | Bots |
| Docs | [Connected apps](connected-apps.md) | this page | this page |
