# K4

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs) ![Bun](https://img.shields.io/badge/Bun-1.4-000?logo=bun) ![Hono](https://img.shields.io/badge/Hono-API-E36002?logo=hono) ![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)

K4 is a personal AI assistant. You sign in and chat with an agent that searches the web and remembers you. Your chats and the agent's memory of you are saved to your account.

## Features

- **Chat with saved history.** Conversations stream live, resume after a reload, and appear in the sidebar. You can delete them from the sidebar.
- **Model and reasoning picker.** Models come through OpenRouter, and the reasoning effort is set per model.
- **Your own model providers.** In **Settings → Model providers**, add your own credentials for 57 providers (OpenAI, Anthropic, Google, xAI, Perplexity, Bedrock, Vertex, Azure, Groq, …) or any OpenAI-compatible https endpoint; their models join the picker, billed to you. Secrets are stored encrypted (`PROVIDER_KEY_SECRET`, the same in `apps/backend` and `apps/ai-agent`) and never sent back to the browser; to rotate it, move the old value to `PROVIDER_KEY_SECRET_PREVIOUS`, set a new one, then run `bun run providers:reseal` in `apps/backend`. The provider and model list is a [models.dev](https://models.dev) snapshot: `bun run providers:sync` in `packages/shared` refreshes it.
- **Three modes:**
  - **Ask:** the agent answers and explains; nothing it can do changes anything, so there is nothing to approve.
  - **Plan:** the agent only plans and can only search the web.
  - **Full:** the agent acts without asking.
- **Web search** with cited sources (Firecrawl).
- **Memory you control.** The agent saves your preferences and lasting facts on its own and uses them in every chat. You can view and edit them in **Settings → Memory**. Memory is stored in Postgres, so it follows your account to any device.
- **Your apps.** 1,800+ apps through Composio (Gmail, Sheets, Slack, ...) and your own MCP servers, picked with `@`.
- **Skills.** Upload a folder or zip and call it with `/`.
- **Cloud computer.** Each user gets an E2B desktop with a live view, browser, shell and terminal.
- **Files.** Attachments and agent outputs stored in Cloudflare R2, with previews.
- **Media.** Image, speech, music and video generation; voice typing.
- **Transparent steps.** The agent's reasoning and every tool call, with its input and output, can be expanded in the chat.

## Architecture

| Path | Role | Stack |
| --- | --- | --- |
| `apps/web` | UI: login, dashboard, chat. Proxies `/eve/v1/*` to the agent. | Next.js 16, React 19, Tailwind 4, shadcn/ui |
| `apps/backend` | API: chats, memory, per-user rate limits. | Hono on Bun, Drizzle, Neon Postgres |
| `apps/ai-agent` | The agent: models, tools, approvals, memory, durable sessions. | eve, OpenRouter, Firecrawl |
| `packages/shared` | Token check, model list, schema, memory, rate limit. | jose, Drizzle |

Sign-in uses **Neon Auth** (Managed Better Auth). The browser sends a short-lived token as `Authorization: Bearer`. The backend and the agent each check it against Neon's public keys, and every query is scoped to that user.

## Getting started

**Prerequisites:** Bun 1.4, a Neon project with Postgres and Neon Auth enabled (Console → Auth), and API keys for OpenRouter and Firecrawl.

```sh
bun install

# Environment: copy each .env.example and fill it in (`neon env pull` fills most of it)
#   apps/backend/.env   apps/ai-agent/.env   apps/web/.env.local

cd apps/backend && bun run db:migrate && cd -              # app tables

bun run dev
```

Open http://localhost:3000. The web app runs on port 3000, the backend on 8787, and the agent is started by the web app in development.

## Development

```sh
bun run test               # unit tests (shared, backend, agent)
bunx biome check --write . # lint and format
```

See [PROJECT.md](PROJECT.md) for the detailed layout, current status and known limitations.
