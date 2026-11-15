# K4

K4 is a personal computer-use AI assistant. You sign in and chat with an agent that can search the web and do real work on **your own Linux desktop in the cloud**, which you can watch live. The desktop keeps its files between chats, and your chats and the agent's memory of you are saved to your account.

## Features

- **Chat with saved history.** Conversations stream live, resume after a reload, and appear in the sidebar. You can delete them from the sidebar.
- **Model and reasoning picker.** Models come through OpenRouter, and the reasoning effort is set per model.
- **Three modes:**
  - **Ask:** risky actions (desktop, shell, file edits) wait for your approval.
  - **Plan:** the agent only plans and can only search the web.
  - **Full:** the agent acts without asking.
- **Web search** with cited sources (Firecrawl).
- **Your own Linux desktop** (E2B: Ubuntu and XFCE). The agent can click, type, open apps and run commands on it. Screenshots appear in the chat, there is a live view link, and the desktop pauses when idle and keeps its files.
- **Shell and file tools** that run on the same desktop, in `/home/user`.
- **Memory you control.** The agent saves your preferences and lasting facts on its own and uses them in every chat. You can view and edit them in **Settings → Memory**. Memory is stored in Postgres, so it follows your account to any device.
- **Transparent steps.** The agent's reasoning and every tool call, with its input and output, can be expanded in the chat.

## Architecture

| Path | Role | Stack |
| --- | --- | --- |
| `apps/web` | UI: login, dashboard, chat. Proxies `/eve/v1/*` to the agent. | Next.js 16, React 19, Tailwind 4, shadcn/ui |
| `apps/backend` | API: chats, desktop setup, screenshot links, per-user rate limits. | Hono on Bun, Drizzle, Neon Postgres |
| `apps/ai-agent` | The agent: models, tools, approvals, memory, durable sessions. | eve, OpenRouter, E2B, Firecrawl |
| `packages/shared` | Token check, model list, E2B desktop helpers, screenshot storage. | jose, E2B SDK, S3 client |

Sign-in uses **Neon Auth** (Managed Better Auth). The browser sends a short-lived token as `Authorization: Bearer`. The backend and the agent each check it against Neon's public keys, and every query is scoped to that user. Screenshots are stored in a private Neon Object Storage bucket.

## Getting started

**Prerequisites:** Bun 1.4, a Neon project (Postgres, Auth, Object Storage), and API keys for E2B, OpenRouter and Firecrawl.

```sh
bun install

# Environment: copy each .env.example and fill it in (`neon env pull` fills most of it)
#   apps/backend/.env   apps/ai-agent/.env   apps/web/.env.local

cd apps/backend && bun run db:migrate && cd -              # app tables
cd apps/ai-agent && bun run workflow:bootstrap && cd -     # agent session store (once)

bun run dev
```

Open http://localhost:3000. The web app runs on port 3000, the backend on 8787, and the agent is started by the web app in development.

## Development

```sh
bun run test               # unit tests (shared, backend, agent)
bunx biome check --write . # lint and format
```

See [PROJECT.md](PROJECT.md) for the detailed layout, current status and known limitations.
