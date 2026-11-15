# Project Overview

Turborepo monorepo (bun workspaces) for an AI agent app: Next.js web UI, Hono API backend, Neon Auth (Managed Better Auth) for login, and an `eve` agent.

## 1. Folder structure

1. `apps/web` — Next.js 16 (App Router, Cache Components, React Compiler, Tailwind 4, shadcn/ui on Base UI).
   - `src/app` — `/` (Login or Dashboard button), `/login`, `/dashboard`, `/dashboard/chat`.
   - `src/app/dashboard/layout.tsx` — shared sidebar + header for all dashboard pages.
   - `src/components/ui` — shadcn components, incl. chat ones (`message`, `bubble`, `message-scroller`, `trace`, `code-block`, `input-group`).
   - `src/components/chat` — chat page: `chat.tsx`, `messages.tsx`, `pickers.tsx`.
   - `src/lib` — `auth-client.ts`, `session.ts`, `ai.ts`. `src/proxy.ts` guards `/dashboard`.
2. `apps/backend` — Hono on Bun, port 8787. Checks the user's Neon Auth token (`src/auth.ts`), Drizzle + Neon Postgres (`src/db`, `drizzle.config.ts`). Creates each user's desktop (`src/desktop.ts`, `POST /api/me/desktop`).
3. `apps/ai-agent` — `eve` AI agent. Own `.env` (`OPENROUTER_API_KEY`, `E2B_API_KEY`, `FIRECRAWL_API_KEY`, `BACKEND_URL`).
   - `agent/agent.ts` — dynamic OpenRouter model + reasoning, chosen per turn by the web picker.
   - `agent/lib/models.ts` — model allowlist and per-model reasoning efforts (from the OpenRouter models API); also imported by web as `ai-agent/models`.
   - `agent/channels/eve.ts` — auth: forwards the browser cookie to the backend's `/api/auth/get-session`; reads `{ model, reasoning, mode }` from `clientContext`.
   - `agent/tools/web_search.ts` — Firecrawl `/search` (replaces eve's built-in `web_search`).
   - `agent/tools/computer.ts` + `agent/lib/desktop.ts` — Linux desktop (E2B Desktop) control with screenshots and a live view URL.
4. `packages/ui`, `packages/eslint-config`, `packages/typescript-config` — starter shared packages.
5. `.claude/skills`, `.agents/skills`, `skills-lock.json` — installed agent skills.
6. Root: `turbo.json`, `biome.json`, `bun.lock`, `AGENTS.md`, `README.md`, this file.

## 2. Done so far

1. Turborepo starter; bun is the package manager.
2. Old `backend` renamed `ai-agent`; new Hono-on-Bun app created as `backend`.
3. Login is Neon Auth (Managed Better Auth): users and sessions live in the `neon_auth` schema, the web app proxies `/api/auth/*` to it (`apps/web/src/app/api/auth`), and the browser sends a short-lived token as `Authorization: Bearer` to the backend and the agent, which check it against `NEON_AUTH_JWKS_URL` (`packages/shared/src/auth.ts`). Sign-in limits and emails are Neon's (shared SMTP for now).
4. Web login: `/login` (shadcn `login-04` layout) with email/password and Google (Neon's shared Google credentials: development only). Home page shows Login or Dashboard by session.
5. Dashboard: shadcn `sidebar-07` as a shared layout. Dark/light/system theme in the user menu (`next-themes`).
6. Chat page `/dashboard/chat`: frontend only. Message scroller, bubbles, reasoning and tool rows, markdown replies, prompt bar with model + reasoning picker and Ask/Plan/Full mode, suggestions, mobile responsive. Replies are scripted (`@shadcn/helpers`).
7. Biome set up at the root (`bunx biome check --write .`); config ignores generated shadcn files.
8. Installed: `@neon/auth`, `jose`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`, `zustand` (not used yet), `ai`, `@ai-sdk/react`, `@shadcn/helpers`, `streamdown`, `next-themes`.

## 3. Not done yet

1. Chat is live: `next.config.ts` wraps the app in `withEve` (eve proxies `/eve/v1/*` to `apps/ai-agent`), and `chat.tsx` uses `useEveAgent`. Conversations are not saved per user yet (a reload starts a new chat).
2. `FIRECRAWL_API_KEY` must be set: keyless Firecrawl is refused from some networks.
3. Production setup: HTTPS, secure cookies, cross-domain cookies if web and backend use different domains, email verification and password reset (no email provider).
4. Firecrawl build skills (`firecrawl-build*`) are installed in `.claude/skills`. Skills for hono, bun, zod, zustand are not installed (`bunx skills add` failed). Commands are in the chat history.
5. Sidebar and dashboard overview still show shadcn demo data.
6. Tests: `bun run test` (turbo runs `bun test` in `packages/shared` and `apps/ai-agent`). No CI workflow yet.

## 4. Run

1. `bun install`, then `bun run dev` at the root (web on 3000, backend on 8787).
2. Env: copy `apps/backend/.env.example` to `.env` and fill it in (Neon URLs, `NEON_AUTH_JWKS_URL`, E2B and storage keys; `neon env pull` fills most of it). `apps/web/.env.example` has the Neon Auth URL, the cookie secret and `NEXT_PUBLIC_API_URL`; `apps/ai-agent/.env.example` has the agent's keys.
3. DB: `cd apps/backend && bun run db:migrate` (migrations in `apps/backend/drizzle`, made with `bun run db:generate`). An existing database made with `push` needs the first migration marked as applied once. `db:push` is for throwaway local databases only.
3a. Agent sessions: set `WORKFLOW_POSTGRES_URL` (direct Neon URL) in `apps/ai-agent/.env`, then `cd apps/ai-agent && bun run workflow:bootstrap` once. Dev and production both store chats in Postgres.
3b. Screenshots: `neon link`, then `neon deploy` (creates the private `screenshots` bucket from `neon.ts`); `neon env pull` writes the AWS_* vars into the apps' `.env`.
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
