# Project Overview

**K4** is a personal computer-use AI assistant. Each signed-in user chats with an agent that can search the web and do real work on the user's own Linux desktop in the cloud (E2B), which the user can watch live. The desktop keeps its files between chats; chats and the agent's memory of the user are saved per user. The user picks the model, the reasoning effort and a mode (Ask: approve risky actions; Plan: plan only; Full: act without asking).

Turborepo monorepo (bun workspaces): Next.js web UI, Hono API backend, Neon Auth (Managed Better Auth) for login, Neon Postgres + Object Storage, and an `eve` agent.

## 1. Folder structure

1. `apps/web` — Next.js 16 (App Router, Cache Components, React Compiler, Tailwind 4, shadcn/ui on Base UI).
   - `src/app` — `/` (Login or Dashboard button), `/login`, `/dashboard`, `/dashboard/chat`, `/dashboard/chat/[id]` (saved chat), `api/auth/[...path]` (Neon Auth proxy).
   - `src/app/dashboard/layout.tsx` — shared sidebar + header; mounts `EnsureDesktop` (calls `POST /api/me/desktop` on every dashboard load; safe to repeat, rebuilds a lost desktop).
   - `src/components/chat` — `chat.tsx` (`useEveAgent`, creates the chat row, saves the eve session id), `messages.tsx` (reasoning rows; tool rows show the tool's input and output, desktop screenshots and the live-view link), `pickers.tsx`, `screenshot.tsx`, `chat-not-found-toast.tsx`. `src/components/chat-history.tsx` — sidebar chat list (several deletes can run at once). `src/components/settings-dialog.tsx` — Settings modal from the user menu: section list on the left, Memory on the right (read-only until Edit, then Save).
   - `src/lib` — `api.ts` (Hono RPC client, bearer token), `auth-client.ts`, `auth/server.ts`, `session.ts`, `highlighter.tsx`. `src/proxy.ts` — Neon Auth middleware (`/eve` is public; the agent checks the token).
   - `next.config.ts` — `withEve` proxies `/eve/v1/*` to `apps/ai-agent`; security headers; `/dashboard` redirects to `/dashboard/chat`.
2. `apps/backend` — Hono on Bun, port 8787. Exports `AppType` as `backend/app` for the web RPC client.
   - `src/auth.ts` — `requireUser`: checks the Neon Auth bearer token, then a per-user limit (120 req/min).
   - `src/chats.ts` — `/api/chats`: list, create, get, patch (`eveSessionId`), delete (ends the eve session, deletes `agent_event` rows and the chat in one transaction), `GET /screenshot` (signed URL after an owner-prefix check).
   - `src/me.ts` + `src/desktop.ts` — `POST /api/me/desktop`: the only place a user's E2B desktop is created (advisory lock, rebuilt if E2B lost it). `GET`/`PUT /api/me/memory`: read and replace the user's memory note (max 8,000 chars).
   - `src/db` — Drizzle + Neon WebSocket pool over `@repo/shared/schema`. Migrations in `drizzle/` (`drizzle.config.ts` points at the shared schema).
3. `apps/ai-agent` — `eve` agent (`.env.example`: OpenRouter, E2B, Firecrawl, `NEON_AUTH_JWKS_URL`, `DATABASE_URL`, `WORKFLOW_POSTGRES_URL`, AWS_* storage).
   - `agent/agent.ts` — dynamic OpenRouter model + reasoning per turn; approval policy by mode (Plan: web_search only; Ask: approve `computer`/`bash`/`write_file`/`edit_file`; Full: no prompts); Postgres workflow world.
   - `agent/channels/eve.ts` — auth: verifies the bearer token, checks the caller owns `/session/:id` (`lib/owner.ts`), per-user limit on POSTs (60/min); validates `{ model, reasoning, mode }` from `clientContext`.
   - `agent/tools/web_search.ts` — Firecrawl search. `agent/tools/computer.ts` — drives the user's E2B desktop, saves screenshots to object storage.
   - `agent/sandbox.ts` + `lib/e2b-sandbox.ts` — eve's bash/file tools run on the same user desktop (never created or deleted by the agent). Workspace root is `/home/user` (eve's default `/workspace` does not exist on E2B desktops).
   - `agent/hooks/persist.ts` — copies every event into `agent_event`.
   - `agent/memory/profile.ts` — custom eve memory provider: one plain-text note per user in `agent_memory` (keyed by the verified user id, one fact per line). Recalled at the start of every turn; tools `profile__save` (atomic append) and `profile__remove` (by number). `instructions.md` tells the agent to save preferences unasked.
   - `agent/lib/db.ts` — `db()`: Drizzle on the Neon HTTP driver over the same shared schema; `appUserId`. `lib/desktop.ts` — looks up the user's desktop. No raw SQL in the agent.
4. `packages/shared` — the modules both apps use, so each rule lives once:
   - `schema.ts` — every app table (`chat`, `agent_event`, `agent_memory`, `user_desktop`, `rate_limit`); `db.ts` — the `Db` type the shared queries take (works with both apps' drivers).
   - `memory.ts` — the user's memory note: read, append (atomic, capped), remove by number, replace, `MAX_MEMORY_CHARS`. Used by the agent's memory provider and the backend's `/api/me/memory`.
   - `rate-limit.ts` — `overLimit(db, key, max, windowMs)`, used by the backend's `requireUser` and the agent's channel.
   - `tools.ts` — the output types of `web_search` and `computer`, used by the tools and by the web chat's tool rows.
   - `auth.ts` (`userFromBearer`, JWKS check), `models.ts` (model allowlist + efforts), `desktop.ts` (E2B desktop create/exists/connect/open), `storage.ts` (screenshots in Neon Object Storage). Has tests.
5. `.claude/skills`, `.agents/skills`, `skills-lock.json` — installed agent skills.
6. Root: `turbo.json`, `biome.json`, `neon.ts` (screenshots bucket), `bun.lock`, `AGENTS.md`, `README.md`, this file.

## 2. Done so far

1. Turborepo starter; bun is the package manager.
2. Login is Neon Auth (Managed Better Auth): users and sessions live in the `neon_auth` schema, the web app proxies `/api/auth/*` to it, and the browser sends a short-lived token as `Authorization: Bearer` to the backend and the agent, which check it against `NEON_AUTH_JWKS_URL` (`packages/shared/src/auth.ts`). Sign-in limits and emails are Neon's (shared SMTP for now).
3. Web login: `/login` with email/password and Google (Neon's shared Google credentials: development only).
4. Dashboard: shadcn `sidebar-07` as a shared layout; theme switch in the user menu. Sidebar lists the user's saved chats.
5. Chat is live and saved: each chat is a `chat` row tied to one eve session; reopening `/dashboard/chat/[id]` resumes it. Sessions and events are stored in Postgres (workflow world) and copied to `agent_event`.
6. Agent: model + reasoning picker, Ask/Plan/Full modes with approvals, Firecrawl web search, per-user memory the user can view and edit in Settings, per-user E2B desktop (computer tool + bash/file tools), screenshots in object storage.
7. Security: session ownership check, per-user rate limits (backend and agent), CORS to the web origin only, security headers, frame-ancestors none.
8. Tests: `bun run test` — `packages/shared` (auth, models, memory), `apps/ai-agent` (owner check), `apps/backend` (404/401 JSON, headers, CORS).
9. Biome at the root (`bunx biome check --write .`).
10. Browser-tested end to end (2026-11-15): sign-in, desktop setup, chat + resume after reload, history, delete chat, web search, desktop (open, click, screenshot, live view), bash, Ask approvals, Plan (no tools run), Full (no prompts), memory across chats.

## 3. Not done yet

1. `FIRECRAWL_API_KEY` must be set: keyless Firecrawl is refused from some networks.
2. Production setup: HTTPS, deploy targets, email verification and password reset (no email provider), `localDev()` is still in the agent's auth list (it rejects requests in production, per eve docs).
3. No per-user spend limit for paid models (TODO in `agent/agent.ts`).
4. Sidebar team switcher / projects and the dashboard overview still show shadcn demo data.
5. No CI workflow. No tests for chat routes, desktop creation or the web chat.
6. The default `openrouter/free` router is unreliable: replies can be filtered ("The model provider filtered this response") or rate-limited upstream. Errors show above the prompt box; pick another model to retry.
7. Tool input schemas must avoid `z.tuple` (array-form `items` is rejected by some OpenRouter providers); see `agent/tools/computer.ts`.
8. `ensureUserDesktop` holds a pooled DB connection while E2B creates a desktop (seconds). Fine at current scale; move the E2B call out of the transaction if many users sign in at once.

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
