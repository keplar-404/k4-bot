# K4 Bot documentation

K4 Bot is a platform for personal AI bots that **think, act and automate**. It combines two kinds of product in one place:

- **Chat bots** (like Grok or ChatGPT): each bot has a role, memory, web research, files, its own Linux computer, a code
  sandbox, installed skills and connected apps, and can work for minutes or days on one request.
- **Automations** (like Zapier or n8n): visual workflows of triggers, app actions, logic, AI steps and approvals that run
  durably on Cloudflare.

The two meet in the middle: bots use the user's connected apps, run and build workflows, and schedule their own tasks;
workflows hand steps to bots.

## Who should read what

| You want to… | Read |
|---|---|
| Run the project on your machine | [Getting started](guides/getting-started.md) |
| Understand how the system fits together | [Architecture overview](architecture/overview.md) |
| Change backend code | [Backend](architecture/backend.md), [Data model](architecture/data-model.md), [Development guide](guides/development.md) |
| Change the web app | [Web app](architecture/web.md), [Development guide](guides/development.md) |
| Understand a feature | [Features](#features) below |
| Review or harden security | [Security](architecture/security.md) |
| Deploy or operate it | [Deployment and operations](guides/operations.md) |
| Fix something that looks broken | [Troubleshooting](guides/troubleshooting.md) |
| Look up an endpoint, a limit or a variable | [API](reference/api.md), [Limits](reference/limits.md), [Configuration](reference/configuration.md) |

## Features

| Feature | What it is |
|---|---|
| [Bots and chat](features/bots-and-chat.md) | Bots, roles, the durable chat run, streaming, permission modes, approvals, memory |
| [Agent tools](features/agent-tools.md) | Every tool a bot can use: web research, files, sub-agents, background tasks, deep research |
| [Computer and sandboxes](features/computer-and-sandboxes.md) | One E2B desktop per user shared by their bots; one code sandbox per bot |
| [Skills and MCP apps](features/skills-and-mcp.md) | Installable skills (skills.sh) and MCP servers |
| [Connected apps](features/connected-apps.md) | Composio: 1,700+ apps, login, bot app tools |
| [Workflows](features/workflows.md) | The builder, every block, triggers, the engine, live runs |
| [Scheduled tasks](features/scheduled-tasks.md) | Grok-style tasks: a bot does something at set times |
| [Secrets](features/secrets.md) | The encrypted vault for API keys that workflows use |
| [Files](features/files.md) | Uploads, generated images, document reading |

## Repository at a glance

```
k4-bot/
├── apps/
│   ├── backend/   Hono API on Cloudflare Workers (Durable Objects, Workflows, R2, Neon Postgres)
│   └── web/       Next.js 16 app (React 19, shadcn on Base UI, Tailwind, zustand, React Flow)
├── packages/      shared eslint config and ui package (scaffolding)
└── docs/          this documentation
```

## Conventions used in these docs

- Paths are relative to the repository root.
- "User" is a signed-in person; "bot" is one of their AI bots; "run" is one execution (of a chat turn or a workflow).
- Limits quoted here are the defaults; most are configurable (see [Configuration](reference/configuration.md)).
- The product decisions behind the design are recorded in [Decisions](reference/decisions.md).
