# Project Overview

Turborepo monorepo (bun workspaces) for an AI agent app: Next.js web UI, Hono API backend with Google/email login, and an `eve` agent.

## 1. Folder structure

1. `apps/web` — Next.js 16 (App Router, Cache Components, React Compiler, Tailwind 4, shadcn/ui on Base UI).
   - `src/app` — `/` (Login or Dashboard button), `/login`, `/dashboard`, `/dashboard/chat`.
   - `src/app/dashboard/layout.tsx` — shared sidebar + header for all dashboard pages.
   - `src/components/ui` — shadcn components, incl. chat ones (`message`, `bubble`, `message-scroller`, `trace`, `code-block`, `input-group`).
   - `src/components/chat` — chat page: `chat.tsx`, `messages.tsx`, `pickers.tsx`.
   - `src/lib` — `auth-client.ts`, `session.ts`, `ai.ts`. `src/proxy.ts` guards `/dashboard`.
2. `apps/backend` — Hono on Bun, port 3001. Better Auth + Drizzle + Neon Postgres (`src/auth.ts`, `src/db`, `drizzle.config.ts`).
3. `apps/ai-agent` — `eve` AI agent (OpenRouter model, E2B sandbox). Own `.env`. Not connected to web/backend yet.
4. `packages/ui`, `packages/eslint-config`, `packages/typescript-config` — starter shared packages.
5. `.claude/skills`, `.agents/skills`, `skills-lock.json` — installed agent skills.
6. Root: `turbo.json`, `biome.json`, `bun.lock`, `AGENTS.md`, `README.md`, this file.

## 2. Done so far

1. Turborepo starter; bun is the package manager.
2. Old `backend` renamed `ai-agent`; new Hono-on-Bun app created as `backend`.
3. Auth in the backend: Better Auth with Google and email/password. Tables `user`, `session`, `account`, `verification`, `rate_limit` (rate limits in DB). CORS allows any localhost in dev, only `WEB_URL` in production.
4. Web login: `/login` (shadcn `login-04` layout) with email/password and Google. Home page shows Login or Dashboard by session.
5. Dashboard: shadcn `sidebar-07` as a shared layout. Dark/light/system theme in the user menu (`next-themes`).
6. Chat page `/dashboard/chat`: frontend only. Message scroller, bubbles, reasoning and tool rows, markdown replies, prompt bar with model + reasoning picker and Ask/Plan/Full mode, suggestions, mobile responsive. Replies are scripted (`@shadcn/helpers`).
7. Biome set up at the root (`bunx biome check --write .`); config ignores generated shadcn files.
8. Installed: `better-auth`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`, `zustand` (not used yet), `ai`, `@ai-sdk/react`, `@shadcn/helpers`, `streamdown`, `next-themes`.

## 3. Not done yet

1. Chat has no backend: needs a route that streams AI SDK UI messages, then swap `transport` in `chat.tsx`. The model, reasoning and mode picks are not sent anywhere.
2. `ai-agent` is not connected to the web app or backend.
3. Production setup: HTTPS, secure cookies, cross-domain cookies if web and backend use different domains, email verification and password reset (no email provider).
4. Skills for hono, bun, zod, zustand are not installed (`bunx skills add` failed). Commands are in the chat history.
5. Sidebar and dashboard overview still show shadcn demo data.
6. No tests.

## 4. Run

1. `bun install`, then `bun run dev` at the root (web on 3000, backend on 3001).
2. Env: copy `apps/backend/.env.example` to `.env` and fill it in (Neon URL, auth secret, Google keys). `apps/web/.env.example` has `NEXT_PUBLIC_API_URL`.
3. DB: `cd apps/backend && bunx drizzle-kit push` (only touches the auth tables, via `tablesFilter`).
4. Check code: `bunx biome check --write .` at the root.

## 5. Tools available to the AI assistant

Use these on demand, not by default.

1. **CodeGraph** — indexed code search (`.codegraph/`); use before grep.
2. **shadcn/ui MCP** and the `shadcn` skill — components, blocks, chat rules. Tip: add `.md` to a `ui.shadcn.com/docs/...` URL to get the full page with code.
3. **E2B docs MCP** — E2B sandbox docs.
4. **Firecrawl** (MCP + skills) — web search, scrape, crawl, research.
5. **Browser** — built-in pane and Claude in Chrome, for checking pages.
6. **Docs/Artifacts, scheduled tasks, terminal** — documents, published pages, recurring tasks, shell tabs.
7. **Agentation** — dev-only UI annotation overlay, loaded in the root layout in development.

## 6. Skills installed (`.claude/skills`)

1. Auth: `create-auth`, `better-auth-best-practices`, `better-auth-security-best-practices`, `email-and-password-best-practices`, `organization-best-practices`, `two-factor-authentication-best-practices`.
2. Database: `drizzle-orm-patterns`, `neon`, `neon-postgres`, `neon-auth`, `neon-functions`, `neon-realtime`, `neon-object-storage`, `neon-ai-gateway`.
3. Next.js: `next-cache-components-adoption`, `next-cache-components-optimizer`, `next-partial-prefetching-*`, `next-bundle-optimizer`, `next-dev-loop`.
4. Monorepo and UI: `turborepo`, `add`, `shadcn`.
5. Agent framework: `eve`.
6. Workflow: `ponytail` (+ audit, debt, help, review).
7. Biome contributor skills (`lint-rule-development`, `formatter-development`, etc.) — not relevant to this app.
8. Global (`~/.claude/skills`): Firecrawl set, Omarchy, Clerk, others.

**Rule: use any of the tools or skills above only when the task calls for it.**
