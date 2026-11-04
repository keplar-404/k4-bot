# 01 — Project Map: how K4 Bot works today

Read this whole file. Every path is relative to the repo root. When this file and the code disagree, the code wins —
open the file and check, then mention the difference in your report.

## 1. Stack

| Part | Tech |
|---|---|
| Monorepo | Bun workspaces + Turborepo. Apps: `apps/backend`, `apps/web` |
| Backend | Hono on a **Cloudflare Worker** (`apps/backend/wrangler.jsonc`) |
| Cloudflare services | Workers, **Durable Objects** (`ChatRelay`, `UserComputer`), **Workflows** (`ChatRunWorkflow`), **R2** (`FILES`), Rate Limiting (`RL` per IP, `RL_WRITE` per user), Cron (daily cleanup) |
| Database | Neon Postgres via Drizzle (`neon-http`). Schema: `apps/backend/src/db/schema/*.ts`. Migrations: `apps/backend/drizzle/` |
| Agent | LangChain **Deep Agents** (`createDeepAgent`, package `deepagents` 1.16.2) + LangGraph, custom checkpointer `NeonHttpCheckpointer` |
| Models | OpenRouter only, via `@langchain/openrouter` (`ChatOpenRouter`). Catalog: `apps/backend/src/modules/agent/models.json` |
| Computer | One **E2B Desktop** sandbox per user (`@e2b/desktop`), owned by the `UserComputer` Durable Object |
| Web | Next.js 16 (Cache Components), React 19, Tailwind 4, **shadcn/ui on `@base-ui/react`**, Biome, typed Hono RPC client |
| Auth | Better Auth (email/password + Google), cookie shared with the API |

## 2. Backend layout (`apps/backend/src`)

```
index.ts            Hono app: CORS, secure headers, body limit, IP rate limit; exports fetch + scheduled
routes.ts           Mounts /api/v1/{auth,bots,chat,computer,files,integrations,models,memory}; exports AppType
scheduled.ts        Daily cron: prunes old chat_event rows
config/env.ts       Zod env schema (parseEnv) + Env bindings type. ADD NEW ENV VARS HERE.
db/schema/          auth, bot, chat, checkpoint, file, integrations, memory, relations
middleware/         auth-guard (session), rate-limit (userLimit)
shared/             context (getRequestContext → {db, env}), validate (zod validator), secrets (AES-GCM), relay-token
modules/
  agent/            the bot's brain (see §4)
  auth/             Better Auth config; provisions the user's computer after verification
  bots/             bot CRUD, roles.ts (ROLE_IDS), schemas
  chat/             threads, runs, history, realtime; run/ = the durable run engine (see §3)
  computer/         E2B desktop: durable/ layers, routes/, tools/, guards
  files/            R2 file store, documents (read_document), pdf-parse, pdf-images, routes/
  integrations/     skills (skills.sh) and MCP apps (catalog, connect, test)
  memory/           long-term memory: store.ts (bot memory + user preferences), routes.ts
```

## 3. A chat run, end to end (the most important flow)

1. Web `POST /api/v1/chat/threads/:id/messages` → `modules/chat/routes/runs.ts`.
   Checks: ownership, model valid, **one active run per thread** (409 `RUN_ACTIVE`), daily quota (skipped for free
   models via `isFreeModel`). Starts `ChatRunWorkflow` with id = message id (idempotent). Returns 202.
2. `modules/chat/run/workflow.ts` loops over **slices** (`runSlice` in `slice.ts`), each a Workflow step:
   - `done` / `failed` → end; `continue` → next slice from the checkpoint;
   - `needs_input` → `step.waitForEvent` (approvals, `ask_user`) up to 7 days;
   - `sleep` → `step.sleep` (`wait_for` tool);
   - `retry` → transient model error: `run.retrying` event, `step.sleep(retryDelayMs(n))`, up to `MAX_MODEL_RETRIES` = 10.
3. `slice.ts` builds the agent (`buildRunAgent` → `agent/agent.ts buildAgent`) with bot, skills, MCP apps, sub-agents,
   memory, files, computer; streams `agent.streamEvents(..., {version:"v3"})` through `consumeRun`
   (`agent/run-stream/index.ts`) into a sink that publishes events.
4. Events go to the thread's **ChatRelay Durable Object** (`chat/relay/`), which numbers them (gap-free `seq`), stores
   them in `chat_event`, and broadcasts over WebSockets.
5. The web reducer (`apps/web/src/features/chat/lib/stream/reduce-event.ts`) applies events; a gap or `run.retrying`
   triggers a reload of history.
6. Failures: `chat/run/provider-error.ts classifyProviderError` maps errors to a `reason`; the web shows
   `reasonMessage(reason)` (`apps/web/src/features/chat/lib/stream/provider-error.ts`). App-written messages carry
   `notice: true` and are shown verbatim.

## 4. The agent (`modules/agent`)

| File | Role |
|---|---|
| `agent.ts` | `buildAgent(options)` → `createDeepAgent({model, tools, backend, skills, middleware, systemPrompt, interruptOn, checkpointer})` |
| `options.ts` | `BuildAgentOptions` / `AgentBot` types. Add new options here. |
| `chat-model.ts` | `chatModelFor` (catalog model + `createModel(tags?)`), `cachingFor` (Anthropic `cache_control`), `extraModel` |
| `models.ts` / `models.json` | Model catalog, `resolveModel`, `isFreeModel`, `modelError` |
| `middleware/stack.ts` | `botMiddleware(...)` — the ordered middleware list (outermost first). Summarizer at 80% via `createSummarizeMiddleware` |
| `middleware/free-vision.ts` | With `openrouter/free`, calls that carry images go to `FREE_VISION_MODEL` |
| `middleware/hide-tools.ts`, `parallel-tools.ts`, `tool-errors.ts` | Hide `task`, cap parallel tools, tool errors → messages |
| `prompts/system.ts`, `prompts/computer.ts` | System prompt sections (`filesSection`, `computerSection`, `memorySection`) |
| `domains/` | Bot roles → playbook, web level, defaults. `types.ts` has `MAX_SUBAGENTS`, `MAX_PARALLEL_TOOLS` |
| `tools/web/` | Tavily search/extract/map/crawl (REST) |
| `tools/subagents/` | `spawn_subagents`, `wait_for_subagents`, `message_subagents` (sync groups inside a slice) |
| `tools/files/` | `generate_image`, `view_image`, `read_document`, `copy_to_computer`, `share_file` |
| `tools/memory.ts` | `update_memory`, `update_user_preferences` |
| `approvals.ts` | `interruptOn` maps (which tools need human approval) |

Deep Agents adds its own built-ins automatically: **todo list (`write_todos`)**, filesystem tools, skills, the
summarizer, patch-tool-calls. Same-named custom middleware **replaces** the built-in one (verified in
`node_modules/.bun/deepagents@1.16.2*/node_modules/deepagents/dist/langsmith-*.js` → `mergeMiddlewareStack`).

## 5. Computer (`modules/computer`) — read the skill `.agents/skills/e2b-computer/SKILL.md` before touching it

`UserComputerDurableObject` is a chain of layers in `durable/`: state → status → sleep → machine → lifecycle → power →
session → meter → control → bots → panel. One E2B desktop per user; each bot is a Linux user; mouse/keyboard lease;
30-second alarm meters minutes, pauses when idle; `close`/`reset` need `force` while bots work (409 `BOTS_WORKING`).
Routes: `computer/routes/control.ts` (`/wake`, `/pause`, `/reset`, `/settings`, `/control/*`, `/snapshot`).
**Phase 2's coding sandbox is a separate system** — copy the patterns, do not mix it into this object.

## 6. Reuse these before writing anything new

| Need | Use |
|---|---|
| DB + env in a route | `getRequestContext(c)` from `shared/context` |
| Validate body | `validate("json", zodSchema)` from `shared/validate` |
| Per-user write rate limit | `userLimit` from `middleware/rate-limit` |
| Auth on a route group | `authGuard` from `middleware/auth-guard` |
| Load a user's file | `loadFile(bucket, db, userId, id)`, `ownedFile` from `modules/files/store.ts` |
| Encrypt a secret | `encryptSecret` / `decryptSecret` from `shared/secrets` |
| Publish a chat event | `publishEvent(env, threadId, type, payload)` from `chat/run/relay.ts` |
| Stop a bot's runs | `stopBotRuns` / `ACTIVE_RUN_STATES` from `chat/cleanup.ts` |
| Today's usage counts | `tokensUsedToday` (chat/threads.ts), `imagesToday` (files/usage.ts), `ocrPagesToday` |
| Classify a model error | `classifyProviderError`, `isTransient` from `chat/run/provider-error.ts` |
| Web: API base URL | `BASE` / `fileUrl` / `downloadFile` in `apps/web/src/features/files/` |
| Web: markdown render | `Markdown` from `@/components/markdown` |
| Web: confirm dialog | `AlertDialog*` from `@/components/ui/alert-dialog` (see `features/computer/components/vm/reset-computer.tsx`) |
| Web: computer state | `useComputerContext()` inside `ComputerProvider` |

## 7. Web layout (`apps/web/src`)

```
app/dashboard/bot/[id]/page.tsx   Bot page: ChatView + ComputerSidebar inside ComputerProvider
app/dashboard/vm/page.tsx         Computer page (VmPage)
components/ui/                    shadcn components (base-ui). components/markdown/ renderer
components/layout/                app-sidebar (left nav), nav-user (Preferences), …
features/chat/                    chat client: lib/ (protocol, errors, outbox, stream reducers), hooks/use-chat/, components/
features/computer/                api/, hooks/, components/ (computer-sidebar.tsx, computer-panel.tsx, panel/*, vm/*)
features/files/                   api/library.ts (listFiles, deleteFile, fileUrl), download.ts, components/ (FileCard, …)
features/integrations/            Plugins dialog (skills + MCP, Test button)
features/memory/                  MemoryDialog (preferences / bot memory)
features/bots/                    bot list, form, roles, domains
```

The right side bar today: `features/computer/components/computer-sidebar.tsx` renders `ComputerPanel` in a fixed
`w-80` aside on wide screens and a `Sheet` on narrow screens. Phase 1 turns it into a tabbed workspace.

## 8. Commands

```
cd apps/backend && bunx tsc --noEmit        # backend types
cd apps/backend && bun run check            # backend check scripts
cd apps/backend && bun run db:generate      # after schema edits; read the SQL
cd apps/backend && bun run db:migrate       # apply
cd apps/web && bunx tsc --noEmit            # web types
cd apps/web && bun run check:chat           # web check scripts
bunx biome check --write <files>            # ONLY your files
```
Local run: `wrangler dev` (backend, port 8787) and `next dev` (web). Secrets are in `apps/backend/.dev.vars`.
