# Project Overview

**K4** is a personal AI assistant. Each signed-in user chats with an agent that searches the web, remembers them, works on the user's own cloud computer (section 9), acts in their apps through Composio (Gmail, Sheets, Slack, ...) or their own MCP servers, follows skills they upload, and makes images, speech, music and video. Chats, files and the agent's memory of the user are saved per user. The user picks the model, the reasoning effort and a mode (Ask, Plan: web reading only, Full).

Turborepo monorepo (bun workspaces): Next.js web UI, Hono API backend, Neon Auth (Managed Better Auth) for login, Neon Postgres, Cloudflare R2 for files, E2B for computers, and an `eve` agent on OpenRouter.

## 1. Folder structure

1. `apps/web` — Next.js 16 (App Router, Cache Components, React Compiler, Tailwind 4, shadcn/ui on Base UI).
   - `src/app` — `/` (Login or Dashboard button), `/login`, `/dashboard`, `/dashboard/chat`, `/dashboard/chat/[id]` (saved chat), `api/auth/[...path]` (Neon Auth proxy).
   - `src/app/dashboard/layout.tsx` — shared sidebar + `DashboardShell` (`src/components/dashboard-shell.tsx`): header (sidebar toggle, right-panel toggle) and a resizable `[page | right panel]` (`components/ui/resizable.tsx`, over `react-resizable-panels` v4). The right panel is collapsed by default and on phones, and only ever collapsed (never unmounted), so the chat's eve stream is not cut.
   - `src/components/right-panel.tsx` — tabs: **Computer** (`computer-panel.tsx`, live view, section 9), **Files** (the chat's files from R2 as `FileCard`s, list cached 60 s, delete), **Terminal** (xterm.js over the backend's terminal socket), and the file viewer (`file-viewer.tsx`).
   - `src/app/dashboard/chat/[id]/page.tsx` + `components/chat/saved-chat.tsx` — load the chat and its saved events (backend, with the IndexedDB copy first) and pass them to `<Chat>` as eve `initialEvents` (section 8).
   - `src/components/chat` —
     - `chat.tsx` (`useEveAgent`, creates the chat row, saves the eve session id, earlier sessions of the chat shown above the live one, paging of old turns, attachments, opens the Computer panel when a computer tool runs or the agent asks after using it, locks Settings > Memory while memory is being saved).
     - `messages.tsx` (one "Steps" block per turn, then the reply; files the agent shared show under the reply; section 7), `split-turn.ts` (+ test).
     - `prompt-menu.tsx` — the prompt bar's menus: `@` apps (connected first, search 1,800+ Composio apps, your MCP servers) as chips, `/` your skills, `+` attach a file / modes. App pages are shared with Settings and kept per page load.
     - `file-card.tsx` (icon or thumbnail, name, size, open/download; signed links reused 4 min, also across reloads via `sessionStorage`), `voice.ts` (mic → `/api/transcribe` → text into the prompt bar; read-aloud with `speechSynthesis`).
     - `pickers.tsx` (model + effort, mode), `chat-stats.tsx` (turns · steps · tok/s, tokens · cache %, context ring %), `open-requests.tsx` (approval/question/budget/connect cards; Send shows "Sending…" until eve settles the request), `chat-skeleton.tsx`, `chat-not-found-toast.tsx`, `chat-cache-owner.tsx`.
   - `src/components/settings-dialog.tsx` — Settings modal: Appearance (theme previews), Memory (read-only until Edit, then Save), Connected apps (Composio; search, filter, connect, disconnect, refresh), Custom connectors (your own MCP servers, hosted by Composio), Skills (upload a folder or zip, problems listed per file, delete).
   - `src/components/chat-history.tsx` — sidebar chat list (several deletes can run at once); `app-sidebar.tsx`, `nav-groups.tsx`, `nav-user.tsx`.
   - `src/lib` — `api.ts` (Hono RPC client, bearer token), `auth-client.ts` (Neon Auth client; caches the token), `auth/server.ts`, `session.ts`, `chat-cache.ts` (IndexedDB copy of each chat and the sidebar list, wiped when another user signs in; one backend recheck per chat per 5 minutes), `chat-ui.ts` (Zustand: open/closed Steps and rows, the computer panel's session/busy/steps, the open file, the right-panel tab). `src/proxy.ts` — Neon Auth middleware (`/eve` is public; the agent checks the token).
   - `next.config.ts` — `withEve` proxies `/eve/v1/*` to `apps/ai-agent` and, in dev, starts that agent (the only `eve dev` in `bun run dev`); security headers; `/dashboard` redirects to `/dashboard/chat`.
2. `apps/backend` — Hono on Bun, port 8787. Exports `AppType` as `backend/app` for the web RPC client. Body limit 64 KB, except skill uploads (11 MB) and audio (1 MB, `transcribe.ts`).
   - `src/auth.ts` — `requireUser`: checks the Neon Auth bearer token, then a per-user limit: reads 240/min (in memory), writes 60/min (Neon counter). `allowedOrigin` for CORS and the terminal socket.
   - `src/chats.ts` — `/api/chats`: list, create, get (the chat plus its saved `agent_event` rows shaped as eve stream events, optional `after`), patch (`eveSessionId`), delete (ends the eve session, deletes the chat's R2 files, then `agent_event` rows and the chat in one transaction).
   - `src/me.ts` — `GET`/`PUT /api/me/memory` (max 8,000 chars). Apps through Composio: `GET /api/me/apps/all` (catalog from `app_cache`, refreshed daily, connected slugs cached 10 min; search, cursor, `status`, `refresh`), `GET /api/me/apps/:slug`, connect (`session.authorize()`), `DELETE /api/me/apps/:slug` (after an ownership check).
   - `src/computer.ts` — `GET /api/me/computer?session=` (start/resume, signed live-view URL), `GET /status`, `POST /pause` (section 9).
   - `src/terminal.ts` — `/api/terminal` WebSocket: a root PTY on the user's computer (E2B). Origin checked; the first message carries the token and size; 10 opens/min; a shell lives at most 1 hour; typing keeps the computer awake.
   - `src/files.ts` — `/api/files`: presigned upload for an attachment (type allowlist, max 100 MB, chat ownership), signed download/inline link (`ownsKey`), list a chat's files (20/min), delete (also removes the copy on the computer, run as that chat's agent).
   - `src/skills.ts` — `/api/me/skills`: list, upload (files with paths or a zip, checked by `checkSkill`; 20 uploads/hour; stored in R2 under a fresh prefix), delete.
   - `src/mcp.ts` — `/api/me/mcp`: list (with connected state), add (URL check, creates or reuses the Composio custom toolkit, returns a Composio connect link for key or sign-in), connect again, delete. Max 20 per user, 10 adds an hour.
   - `src/transcribe.ts` — `POST /api/transcribe`: voice typing via OpenRouter transcription; 1 request per 2 s per user, 60/min overall, 30 min of audio per user per day.
   - `src/db` — Drizzle + Neon WebSocket pool over `@repo/shared/schema`. Migrations in `drizzle/` (`0000`–`0011`, `drizzle.config.ts` points at the shared schema).
3. `apps/ai-agent` — `eve` agent (`.env.example`: OpenRouter, Firecrawl, Composio, E2B, R2, `NEON_AUTH_JWKS_URL`, `DATABASE_URL`).
   - `agent/agent.ts` — dynamic OpenRouter model + reasoning per turn, with each model's real context window; Claude models get top-level `cache_control`, and `session_id` keeps a chat on one provider. Approval policy by mode (Plan: only `web_search`, `web_fetch`, `ask_question`, the skill tools and `eve__*`; Ask: approval before `computer_*`, `browser`, `app`, `share_file`, `download_file`, `delete_file`, `media`, `video` and Composio's execute tool; Full: no prompts). Budget prompt at 200K new input tokens, then 400K, 800K and so on (per chat). No Workflow world set; sessions end after 7 idle days, run data deleted (retention 0).
   - `agent/channels/eve.ts` — auth: verifies the bearer token, checks the caller owns `/session/:id` (`lib/owner.ts`; owner from one `agent_event` row, then an in-memory cache of 10,000; a brand-new session falls back to the session stream), 60 POSTs/min per user (in parallel with the owner check); validates `{ model, reasoning, mode }` from `clientContext`. A new session for an existing chat is seeded with the chat's last 50 text messages (`chatHistory`).
   - `agent/connections/apps.ts` — dynamic MCP connection to the user's Composio session (Composio user = Neon Auth user id, `mcp: true`, sandbox off). Custom toolkits other users added are disabled in the session (`hiddenCustom`, once per turn). `COMPOSIO_MANAGE_CONNECTIONS` is blocked: connecting goes through `tools/connect_app.ts` (`ctx.ask`; the web shows a Connect card with the app logo).
   - `agent/instructions/mcp.ts` — servers the user picked with `@` in the prompt bar: the web sends their names as `clientContext.mcp`, `channels/eve.ts` validates them (`pickedMcp`) into the turn's auth, and this file (only for names that are really the user's servers) gives the model the toolkit slug and its tool slugs, to run through `COMPOSIO_MULTI_EXECUTE_TOOL`.
   - `agent/instructions.md` + `agent/instructions/skills.ts` — the user's skills (names and descriptions, up to 30; otherwise "use `find_skill`") added to the instructions each turn.
   - Tools (`agent/tools/`):
     - Web: `web_search` (Firecrawl), `ask_question`.
     - Computer (section 9): `browser`, `app`, `computer_shell`, `computer_browser`, `computer_app`. Skills `browser-use` and `cua-driver` in `agent/skills/`.
     - Files (`lib/files.ts`): `share_file` (computer → R2 download card), `download_file` (attachment → the computer), `delete_file` (R2), `view_file` (look at an image or PDF; text-only models get a description from a vision model, `visionModels`).
     - Media (`lib/media.ts`: OpenRouter with retries, daily quotas): `media` (image, image edit, speech, transcribe, music), `video` (workflow tool: submit, poll every 15 s up to 20 min, save). Results go to `~/Media` on the computer.
     - Skills: `find_skill`, `load_skill`, `read_skill_file`, `search_skill` (from R2; max 400 lines / 40,000 chars per read).
     - Disabled with `disableTool()`: `agent` (no helper agents), `bash`, `read_file`, `write_file`, `edit_file` (computer tools replace them).
   - `agent/hooks/persist.ts` — copies every fact (not token deltas) into `agent_event` with its `scope` (`{}` for session-level events), page text stripped (`lib/page-text.ts`). Batched: written at once on `turn.settled`, `turn.paused`, `interaction.opened`, `session.ended` or 100 rows, otherwise within 1 s, not awaited.
   - `agent/memory/profile.ts` — custom eve memory provider: one plain-text note per user in `agent_memory`. Recalled at the start of every turn; tool `profile__update` (replaces the whole note; `always()` approval; hidden in Plan).
   - `agent/lib/` — `db.ts` (Drizzle on the Neon HTTP driver; `appUserId`), `mode.ts` (`modeOf`, `notInPlan`), `owner.ts`, `computer.ts` (`onComputer`, `oneAtATime` desktop lock), `browser.ts` (browser slots, cookie jar), `files.ts`, `media.ts`, `skills.ts`, `page-text.ts`. No raw SQL in the agent.
   - `package.json` — `dev:tui` runs `eve dev` (terminal UI) for testing only; stop `bun run dev` first so only one agent takes jobs.
4. `packages/shared` — the modules both apps use, so each rule lives once:
   - `schema.ts` — every app table: `chat`, `agent_event` (+ `scope`), `agent_memory`, `user_computer`, `app_cache`, `rate_limit`, `user_skill`, `user_mcp`. `db.ts` — the `Db` type the shared queries take (works with both drivers).
   - `auth.ts` (`userFromBearer`, JWKS check, EdDSA), `models.ts` (chat model allowlist with efforts and context windows, `visionModels`, `mediaModels`, `pickEffort`, `pickMediaModel`), `memory.ts`, `rate-limit.ts` (`overLimit` in Neon with an optional amount, `overLimitInMemory`, `DAY_MS`), `tools.ts` (`web_search` output type).
   - `computer.ts` — the user's E2B desktop (`userDesktop`, `runOnComputer`, `agentDisplay`, `streamToken`, `computerOn`, `pauseComputer`, warm cache, firewall, `k4-install`). `scripts/computer-template.ts` builds the `k4-desktop` template; `scripts/k4-agent.sh` sets up each agent's desktop.
   - `files.ts` (type allowlist, 100 MB max, `chatPrefix`, `fileKey`, `ownsKey`, `cleanFileName`, `typeOf`), `r2.ts` (presigned upload/download, head, list, put, delete, delete by prefix).
   - `skills.ts` (`checkSkill`, `unzipSkill`, `skillPrefix` `u/<user>/s/<name>/`, list/find/get), `mcp.ts` (`mcpUrlError`: public https, no key in the URL; `listMcp`, `hiddenCustom`, `slugInUse`; Composio Custom MCP API: `ensureToolkit`, `deleteToolkit`, `toolkitTools`).
   - Tests: auth, models, memory, rate limit, files, skills, mcp.
5. `.claude/skills`, `.agents/skills`, `.commandcode/skills`, `skills-lock.json` — installed agent skills (the same sets in each).
6. Root: `turbo.json`, `biome.json`, `bun.lock`, `AGENTS.md`, `README.md`, this file.

## 2. Done so far

1. Turborepo starter; bun is the package manager.
2. Login is Neon Auth (Managed Better Auth): users and sessions live in the `neon_auth` schema, the web app proxies `/api/auth/*` to it, and the browser sends a short-lived token as `Authorization: Bearer` to the backend and the agent, which check it against `NEON_AUTH_JWKS_URL` (`packages/shared/src/auth.ts`). Sign-in limits and emails are Neon's (shared SMTP for now).
3. Web login: `/login` with email/password and Google (Neon's shared Google credentials: development only).
4. Dashboard: shadcn `sidebar-07` as a shared layout; themes in Settings > Appearance. Sidebar lists the user's saved chats.
5. Chat is live and saved: each chat is a `chat` row tied to one eve session; reopening `/dashboard/chat/[id]` resumes it. Events are copied to `agent_event`. A chat whose session ended starts a new session seeded with its history; earlier sessions' turns show above.
6. Agent: model + reasoning picker, Ask/Plan/Full modes with approvals, Firecrawl web search, per-user memory the user can view and edit in Settings. On 2026-11-16 the old `computer` tool and the `user_desktop` table were removed (migration `0002_drop_user_desktop`); the per-user computer came back as the design in section 9 (`user_computer`). Old chats show removed tool calls as plain JSON.
7. Security: session ownership check, per-user rate limits (backend and agent), CORS to the web origin only, security headers, frame-ancestors none, R2 keys scoped by owner, MCP keys and sign-ins kept by Composio (never in K4), computer firewall.
8. Tests: `bun run test` — `packages/shared` (auth, models, memory, rate limit, files, skills, mcp), `apps/ai-agent` (owner check, mode, persist), `apps/backend` (404/401 JSON, headers, CORS, routes). Web: `cd apps/web && bun test src/components/chat` (part ordering; `*.test.ts` is excluded from the web `tsconfig`, which has no Bun types).
9. Biome at the root (`bunx biome check --write .`).
10. Browser-tested end to end (2026-11-15): sign-in, desktop setup, chat + resume after reload, history, delete chat, web search, desktop (open, click, screenshot, live view), bash, Ask approvals, Plan (no tools run), Full (no prompts), memory across chats.
11. Chat UI rework (2026-11-16): a Steps block per turn, placeholder row the moment a message is sent, parts in the order the model produced them, bottom-stacking scroll. Details in section 7.
12. Performance and UI (2026-11-17, on the longest chat, a 2.4 MB stream): opening a chat 6–14s → about 1.2–2s; sidebar switch ~1.1–1.3s; a new chat's first reply ~3s on the free router. Done by: owner check from `agent_event` + cache, a non-blocking persist hook, saved events as `initialEvents`, and only one `eve dev`. Also: the chat stats line, the resizable right panel, real context windows, "Sending…" on cards.
13. Connected apps through Composio: `@` menu and Settings > Connected apps, catalog cache (`app_cache`), Connect cards in the chat.
14. Files: attachments and shared files in R2 per chat, file cards with cached thumbnails, doc viewer, Files tab, deleted with the chat.
15. Media: images, edits, speech, transcription, music and video through OpenRouter, with daily quotas per user (images 20, videos 3, music 10, speech 30 min, transcription 60 min). Vision fallback (`view_file`) for text-only models.
16. Voice typing (`/api/transcribe`) and read-aloud of replies.
17. Skills: upload in Settings > Skills (`user_skill` + R2), `/` menu, the agent's skill tools.
18. Your own MCP servers: Settings > Custom connectors (`user_mcp`), hosted by Composio as Custom MCP toolkits.
19. Right panel: Computer (live view, Take control, Stop/Start, uptime, expand), Files, Terminal (root shell). The computer pauses after 5 idle minutes, with no lock screen.
20. UI redesign (2026-11-25): chat interface and settings.

## 3. Not done yet

1. `FIRECRAWL_API_KEY` must be set: keyless Firecrawl is refused from some networks.
2. Production setup: HTTPS, deploy targets, email verification and password reset (no email provider). See the deploy checklist in section 4.
3. No per-user spend limit for paid chat models (TODO in `agent/agent.ts`); the budget prompt is per chat. Media has daily quotas.
4. The live-view URL carries the VNC password as a query parameter (`apps/backend/src/computer.ts`), so it can land in browser history. The signed stream token already limits access to one screen for 15 minutes.
5. No CI workflow. No tests for chat, files, skills or computer routes, or the web chat beyond part ordering.
6. The default `openrouter/free` router is unreliable: replies can be filtered or rate-limited upstream. Errors show above the prompt box; pick another model to retry.
7. Tool input schemas must avoid `z.tuple` (array-form `items` is rejected by some OpenRouter providers).
8. `startOrder(agent.events)` scans every event on each render. Cache it by event count if very long chats get slow.
9. Markdown images in replies show "[Image blocked]" (Streamdown's URL allowlist).
10. Plan mode allows `web_fetch`, `ask_question` and the skill tools besides `web_search`, and eve's own `eve__*` tools.
11. Part order after a refresh: chats opened from saved events have no token deltas, so a thinking part can show below the calls it led to. Fix: also save each part's first `content.delta`, or order by run.
12. Agent runs are not in Neon: `eve dev` keeps them in `apps/ai-agent/.eve/`, Vercel uses Vercel Workflow. The old Postgres world used up the 5 GB free network transfer in one day.
13. Dev snapshots: eve keeps 5 (or 30 minutes) in `.eve/dev-runtime/snapshots/`. A session mid-turn on a pruned snapshot fails for good (`ENOENT … compiled-agent-manifest.json`): start a new chat. Sessions started on another machine can't run here either.
14. Chats saved before 2026-11-17 have no `scope`, so they open by full replay until backfilled.
15. `eve__search` errors such as `No entries are named "googlesheets__…"` are the model guessing tool names: harmless, one extra step.
20. Custom MCP servers must be remote (https). Composio can't run local-only (stdio) servers such as `npx shadcn@latest mcp`; they need someone to host them at a public https URL.
23. Two approvals at once: the answered card keeps its spinner until the other is answered (eve settles both together). Works, but can look stuck.
17. Serverless: the persist hook buffers mid-turn rows in memory behind a 1 s timer, and the read rate limit, owner cache and warm-computer cache are per instance. On Vercel, mid-turn rows can be lost if the function stops first, and the in-memory limits barely hold.
18. A new session for an old chat is seeded with only the last 50 text messages.

## 4. Run

1. `bun install`, then `bun run dev` at the root (web on 3000, backend on 8787; Next starts the agent). Terminal UI for testing: stop `bun run dev`, then `cd apps/ai-agent && bun run dev:tui`. Traces of every turn: `cd apps/ai-agent && bunx eve traces list` / `bunx eve traces show [id] --verbose` (no server needed).
2. Env (there are no `.env.example` files in the repo; `.env*` is gitignored). `neon env pull` fills the Neon ones. Read by the code:
   - `apps/backend/.env`: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (migrations), `NEON_AUTH_JWKS_URL`, `WEB_URL` (CORS), `EVE_URL`, `OPENROUTER_API_KEY`, `COMPOSIO_API_KEY`, `E2B_API_KEY` (read by the E2B SDK), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
   - `apps/ai-agent/.env`: `DATABASE_URL`, `NEON_AUTH_JWKS_URL`, `OPENROUTER_API_KEY`, `COMPOSIO_API_KEY`, `FIRECRAWL_API_KEY`, `E2B_API_KEY`, the four `R2_*`. `K4_LOCAL_DEV_AUTH=1` only through `bun run dev:tui`.
   - `apps/web/.env`: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `NEXT_PUBLIC_API_URL`.
3. DB: `cd apps/backend && bun run db:migrate` (migrations in `apps/backend/drizzle`, made with `bun run db:generate`). An existing database made with `push` needs the first migration marked as applied once. `db:push` is for throwaway local databases only.
4. Check code: `bunx biome check --write .` at the root.
5. Deploy checklist (production):
   - Don't set `K4_LOCAL_DEV_AUTH` anywhere but a developer machine running `bun run dev:tui`: it turns on eve's `localDev()` login, which needs no token.
   - Run `bun run db:migrate` (from `apps/backend`): `0012` empties `user_mcp` and drops the old key/OAuth columns and `mcp_oauth_client`; `0013` adds `slug` and `auth`. Servers added before 2026-11-25 are gone: users add them again. `MCP_SECRET_KEY` and `MCP_OAUTH_CLIENTS` are no longer read.
   - The backend gzips JSON itself (`compress()`). If a proxy in front also compresses, it skips responses that already have `Content-Encoding`.

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
5. Agent framework and apps: `eve`, `composio`, `firecrawl-build*`, `sai-computer`.
6. Workflow: `ponytail` (+ audit, debt, help, review).
7. Biome contributor skills (`lint-rule-development`, `formatter-development`, etc.) — not relevant to this app.
8. Global (`~/.claude/skills`): Firecrawl set, Omarchy, Clerk, others.

**Rule: use any of the tools or skills above only when the task calls for it.**

## 7. Chat UI: how a turn renders

**State.** The conversation lives only in eve's `useEveAgent` store: it folds the NDJSON event stream from `/eve/v1/*` into `messages` (each with `parts`) and `view`. Components only project it; nothing copies messages into another store. Zustand (`lib/chat-ui.ts`) holds only UI choices (open/closed Steps `steps:<messageId>`, thinking and tool rows `t:<callId>`, computer panel state, open file, panel tab), so they survive remounts. Everything else is local `useState`.

**Events → UI.** `delivery.consumed` turns the optimistic user bubble into a sent one. `turn.started` makes `activeTurn(view)` defined (the composer shows Stop). `content.delta` streams text/reasoning parts (`state: "streaming"`), `content.completed` finishes them. `call.input` → tool part `streaming` with `inputText`; `call.requested` → validated `input`; `call.settled` → `output`/`error`. `interaction.opened` → approval/question/connect cards (`agent.respond`). `turn.settled` → turn done, Steps folds. Model and usage events feed only the stats line (`chat-stats.tsx`).

**One turn on screen** (`messages.tsx`):
- `PendingAssistant` shows at once after send, while the last message is still the user's and the agent is busy, so there is no blank gap before the first event.
- `Steps`: logo + "Deep diving" (shimmer) while running, open; "Steps N · Xs" with a chevron when done, folded. A user click overrides the auto open/close. Stays open while an approval is waiting. One `sr-only` status line instead of announcing every update.
- Rows inside: thinking (`ReasoningRow`, max 12rem, auto-follows new text unless scrolled up, bottom fade), tool rows (icon per tool, spinner while running, one-line gist: query/command/typed text/URL; closed unless asking for approval), narration (small italic line with a speech icon, trimmed).
- The reply is the text after the last non-text part, rendered with Streamdown; files the agent shared show under it as file cards; copy/vote/read-aloud buttons after the turn ends.
- User messages show attached files as compact file cards above the bubble.

**Part order** (`split-turn.ts`). eve sorts a turn's parts by when each was *recorded*. Thinking is recorded when it ends, after the calls that followed it, and streaming parts sort last, so parallel tool calls showed above the thinking that led to them. `startOrder(agent.events)` maps each part id / call id to when it first appeared on the stream. `splitTurn` sorts by `stepIndex`, then by that start order. Fallback when a step has parts the stream doesn't name (imported history): thinking, narration, then calls. A step uses one ordering or the other, never a mix. Also dropped: hidden tools, file parts, empty (redacted) reasoning parts.

**Scrolling.** shadcn `MessageScroller` with `autoScroll` and no `scrollAnchor`: the chat stacks from the bottom and follows the stream until the user scrolls up; the ↓ button resumes following. Older turns are paged in (`OlderMessages`).

## 8. Opening a saved chat

eve's documented way (`guides/frontend/nextjs.mdx`, "Resume a saved session"): the page gives `useEveAgent` the saved events as `initialEvents`, plus `initialSession` and `resume: true`. The store shows them at once and then streams only from `view.position`.

- The browser first shows its IndexedDB copy (`chat-cache.ts`) and asks the backend only for events after the cached position (`?after=`), at most once per chat per 5 minutes.
- Saved events come from `agent_event` (facts only). Facts alone rebuild the same view as a full replay (checked on a 9,889-line chat: 446 facts, identical turns, parts, calls and usage).
- Each row becomes `{ type, scope, data, meta: { position: { line, index }, at } }`, and every event except the last of its line gets `meta.endOfLine: false`; without it eve throws "Saved events overlap source lines already covered".
- While catching up, `status` is `resuming` and the composer is disabled (eve's rule); with saved events the history is already on screen.
- A session that is gone (404, `session_stranded`, `session_not_active`) is replaced by a new session for the same chat, seeded with its history (`chatHistory` in `channels/eve.ts`).

## 9. The user's computer (E2B desktop, agent desktops, live view)

**What it is.** Each user has one cloud computer: an E2B desktop from the template `k4-desktop` (Ubuntu 22.04 + XFCE, Chrome, LibreOffice, GIMP, Cua Driver 0.54.0, Browser Use harness 1.0.6; built by `packages/shared/scripts/computer-template.ts`, 4 vCPU / 8 GB). Its id, live-view password and stream key are in `user_computer`. It pauses after 5 idle minutes (`IDLE_MS`; free while paused) and resumes when used; the screensaver lock is off. A computer that hung while paused is cold-booted from disk (files kept). One deleted on E2B's side is recreated.

**One Linux user and desktop per agent.** Each chat's agent (eve session) gets its own Linux user `a<10 hex>`, X display `:N`, XFCE on its own D-Bus, Chrome (CDP port 9222+N, its own profile), Cua Driver daemon, and VNC on 5900+N. `packages/shared/scripts/k4-agent.sh` (installed as `/usr/local/bin/k4-agent`) sets this up. Every agent home (and the user's) is readable by all agents (group `k4`, `750`), writable only by its owner; `~/Shared` is writable by all. Agents' only root access is `sudo k4-install PKG...` (package names only; the script and sudoers line are checked by hash and rewritten if changed). At most 4 agent desktops run at once; the least recently used one gives up its slot (its files stay). The user's own desktop is `:0`.

**Agent tools** (`apps/ai-agent/agent/tools/`, all through `runOnComputer` in `packages/shared/src/computer.ts`):
- `browser` (simple, for small models): `open`, `read` (page text + numbered links/buttons/fields), `click`, `type`, `back`.
- `app` (simple): `open` an app, `read` its window (numbered accessibility tree), `click` (one number or a list in order), `type`. Desktop steps run one at a time per agent (`oneAtATime`, `flock`).
- `computer_shell` (bash as the agent), `computer_browser` (raw Browser Use harness Python), `computer_app` (one raw Cua Driver call). Skills `browser-use` and `cua-driver` are in `agent/skills/`.
- Browser calls go through `agent/lib/browser.ts`: each parallel call takes a free slot (own harness daemon and tab, up to 4); the agent's Chrome loads the shared cookie jar (`/home/shared/.k4/cookies.json`) before a script and merges its cookies back after (newest wins, file lock), so a login made by one agent reaches every agent; the worked tab is brought to the front.
- Each command and its input go in one script file run as the agent user (`cwd` = its home), input as a heredoc with a random end marker; output trimmed to 12,000 / 4,000 chars.
- Speed: a warm computer (connected in the last 60 s, per user, max 50) skips the database read, connect and checks: a call is one file write and one run (~0.7 s instead of ~2-3 s).
- Ask mode asks before each computer action (`computer_*`, `browser`, `app`); Plan mode hides them.
- Measured with the free router: a browser task (open, click, read heading) 28 s / 3 steps; a calculator task 44 s / 5 steps / 20K tokens (was 144 s / 24 steps / 179K before multi-click).

**Live view (direct).** The stream goes **E2B → browser**; the backend only signs a token. `GET /api/me/computer?session=<eve session>` returns a noVNC URL on the computer itself (`6080-<sandbox>.e2b.app`) whose `path` carries a JWT (HS256, 15 min) naming one screen's VNC port (5900 = the user's, 5900+N = agent N), plus the computer's `startedAt` for the uptime. Inside the computer, one websockify with its `JWTTokenApi` plugin checks the token (per-computer key in `user_computer.stream_key`, never sent to the browser). The computer is created with public traffic (E2B only takes its own token as a header, which an iframe can't send), so it locks itself with `iptables`: from outside only 6080 (stream) and 49983 (E2B's envd) answer. Computers made before this (private, no key) are replaced once on next use.

The web's `ComputerPanel` asks `GET /status` on mount and starts nothing until the computer is on or the user turns it on. It opens by itself when a computer tool starts, is view-only until **Take control** (captchas, sign-ins, 2FA; the agent is told to hand these to the user), can expand to full screen (Esc closes), and shows the uptime. **Turn off** pauses the computer at once (`POST /api/me/computer/pause`; billing stops, everything is kept); **Turn on**, or any agent's next computer call, resumes it. The stream is dropped before pausing, because E2B auto-resumes a paused computer when traffic reaches it. Agents have no stop tool on purpose: one chat could pause the computer under another chat's running agent.

**Terminal.** The right panel's Terminal tab is a root shell on the user's computer: xterm.js ⇄ `/api/terminal` WebSocket ⇄ an E2B PTY (`apps/backend/src/terminal.ts`). It starts the computer if needed.

**Where to host what**

| Part | Host | Why |
|---|---|---|
| `apps/web` (Next.js) | Vercel | Native Next.js host. |
| `apps/ai-agent` (eve) | Vercel (`eve deploy`) | eve's documented target; runs on Vercel Workflow. |
| `apps/backend` (Hono on Bun) | Vercel | The live view doesn't pass through it. The terminal WebSocket needs a host that keeps WebSockets open. |
| Computers | E2B (Pro for real users) | Hobby caps a running computer at 1 hour (pausing resets it) and has 10 concurrent sandboxes; Pro allows 24 hours and 100. |
| Files | Cloudflare R2 | Presigned uploads/downloads; the key prefix is the owner check. |
| Database | Neon | Unchanged. |

Rebuild the template after changing `computer-template.ts` or `k4-agent.sh`: `cd packages/shared && bun --env-file=../../apps/ai-agent/.env scripts/computer-template.ts`. Existing computers keep their old image; delete their `user_computer` row (and the E2B sandbox) to give a user a fresh one.

**Known limits.** Each agent runs its own Chrome process (a profile can't be shared by two running Chromes: Chromium's `SingletonLock`), so logins are shared by syncing cookies (above); passwords saved in Chrome and other apps' settings are not synced. Screenshots don't reach the model as images from computer tools, so the agent works from the accessibility tree and page text; `view_file` can look at an image file it saved. Live view is noVNC, not Cua's H.264 stream.

## 10. Files, media, skills and your own servers

**Files.** No file table: R2 keys are `u/<user>/c/<chat>/<uuid>/<name>` (`packages/shared/src/files.ts`), and `ownsKey` checks the prefix. Attachments: the web asks `POST /api/files` for a URL signed for that exact name, type and size, uploads straight to R2, and the message carries the file id. The agent's `share_file` makes the computer upload straight to R2 (signed for 60 s, size and type checked after); `download_file` copies an attachment to the computer; `delete_file` removes it from R2. Allowed types are listed in `ALLOWED_FILE_TYPES`; max 100 MB. Deleting a chat deletes its prefix.

**Media.** `media` and `video` call OpenRouter (`agent/lib/media.ts`: 60 s timeout, 3 tries on 429/5xx). Models are in `mediaModels` (first = default, free where one exists; no free video model). Quotas are counted before each call in `rate_limit` (`media:<kind>:<user>`, per day). Video is a durable workflow tool, so a restart doesn't pay for a second video.

**Skills.** Upload in Settings > Skills (folder or zip, at most 50 files / 10 MB). `checkSkill` needs a `SKILL.md` with a name and description, and checks each path and file. Files go to R2 under `u/<user>/s/<name>/` (outside chat routes); `user_skill` keeps name, description, prefix and file list. The agent sees names each turn and reads skills only from R2, never from the computer.

**Your own MCP servers (Composio Custom MCP).** Settings > Custom connectors: name (`[a-z][a-z0-9-]`), public https URL, and how it signs in: no sign-in, API key (with the header it goes in), or sign-in (OAuth with dynamic client registration). The backend creates a Composio custom toolkit (`POST /api/v3.1/custom/toolkits`) and saves the row (`user_mcp`: user, name, url, slug, auth). For a key or sign-in it returns Composio's connect link; the user types the key or signs in on Composio's page, so K4 never sees keys or tokens, and Composio refreshes tokens and makes every call. In chat, the servers picked with @ go in `clientContext.mcp`; `agent/instructions/mcp.ts` lists their tools and the model runs them through the user's Composio session. Ask mode asks before every `COMPOSIO_MULTI_EXECUTE_TOOL`; Plan mode hides them. Not connected yet → the model calls `connect_app` with the toolkit slug. Tool results over 20 KB are stored in `agent_event` as a 2 KB preview.

**Free (Hobby) plan caveats.** Custom toolkits are shared by the whole Composio project (`user_id: "all"`), one per URL; each user still connects their own account. So K4: disables other users' toolkits in each agent session (`hiddenCustom`), hides `custom_*` slugs from the Connected apps catalog and its routes, reuses the existing toolkit when a second user adds the same URL (its auth stays as first chosen; Settings says so), and on delete only removes this user's connection unless they were the last user, then deletes the toolkit at Composio. The Composio dashboard shows every user's URLs. Sign-in works only for servers that allow client registration (Notion, Linear, ... ; not GitHub or Asana: use an API key); discovery assumes `<origin>/.well-known/oauth-authorization-server`. Tools are read when the toolkit is made; if the server adds tools later, remove and re-add it. On Pro, make toolkits private (`user_id` = the user) and `hiddenCustom` can go.
