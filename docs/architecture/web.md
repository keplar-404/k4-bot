# Web app (`apps/web`)

Next.js 16 (App Router, Turbopack, Cache Components) with React 19. It is a client of the backend API: it holds no
secrets and trusts nothing it renders. Every rule is enforced again by the server.

## Layout

```
apps/web/src/
├── app/                  Routes (thin pages that render a feature component)
│   ├── (auth)/           sign-in, sign-up, forgot-password, reset-password
│   ├── dashboard/        the signed-in area (sidebar layout)
│   └── workflows/[id]/   the full-screen workflow builder
├── features/             One folder per feature: api client, hooks, components, stores
├── components/
│   ├── ui/               shadcn components (style base-vega on Base UI): do not edit by hand, add with the shadcn CLI
│   ├── ai-elements/      chat UI building blocks (messages, tool calls, reasoning)
│   ├── layout/           sidebar, page header, theme toggle
│   └── markdown/         message rendering
├── hooks/, lib/          small shared helpers
└── proxy.ts              Next.js proxy (middleware): redirects to sign-in when the session is not valid
```

## Routes

| Path | Feature folder | What it is |
|---|---|---|
| `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` | `features/auth` | Better Auth flows (email + password, Google) |
| `/dashboard` | `features/bots` | Your bots |
| `/dashboard/bot/[id]` | `features/chat`, `features/workspace`, `features/computer`, `features/code-editor` | The chat with one bot, plus its workspace: computer screen, files, code editor |
| `/dashboard/avatar` | `features/avatar` | Create or edit a bot (avatar, role, model, capabilities, apps) |
| `/dashboard/connect` | `features/connect` | Connect apps (Composio catalog of 1,700+ apps) |
| `/dashboard/workflow` | `features/workflows` | Workflow overview: cards, on/off, run stats |
| `/workflows/[id]` | `features/workflows/builder`, `features/workflows/live` | The builder (canvas, block library, settings, runs) |
| `/dashboard/tasks` | `features/tasks`, `features/schedules` | Scheduled bot tasks |
| `/dashboard/secrets` | inline page | The secrets vault for workflows |
| `/dashboard/files` | `features/files` | Every stored file |
| `/dashboard/vm` | `features/computer` | The user's computer (full screen) |
| `/dashboard/sandboxes` | `features/sandboxes` | Bots' code sandboxes |
| `/dashboard/skills`, `/dashboard/mcp` | `features/integrations` | Skills and MCP servers |

## Talking to the backend

- Base URL: `NEXT_PUBLIC_AUTH_URL` (default `http://localhost:8787`). Each feature has its own small `api.ts` that
  calls `fetch(`${BASE}/api/v1/...`, { credentials: "include" })`, maps errors to user-facing messages and redirects to
  sign-in on `401`.
- Types: the web imports backend types with the `@backend/*` alias (for example the workflow graph schema), so both
  sides share one definition.
- Session check: `proxy.ts` asks `GET /api/v1/auth/get-session` with the request cookies. If the API cannot be reached
  it lets the page load instead of looping to sign-in.

## Realtime

| Socket | Server | Used by | Auth |
|---|---|---|---|
| Chat stream | `ChatRelay` DO, `GET /chat/threads/:id/ws` | `features/chat/hooks/use-chat` | Short-lived signed token (`POST …/ws-token`), resume from last `seq` |
| Workflow live | `WorkflowRunRelay` DO, `GET /workflows/:id/live` | `features/workflows/live` | Signed token (`POST /workflows/:id/live-token`), owner only; falls back to polling after 3 failed connects |
| Computer status | `UserComputer` DO, `GET /computer/ws` | `features/computer` | Signed token (`POST /computer/ws-token`) |
| Computer screen | noVNC through `GET /computer/stream/:mode/:userId/:token/*` | `ComputerScreen` iframe | Token in the path (an iframe cannot send headers) |

A WebSocket cannot carry the cookie to another origin, which is why each socket mints a short-lived HMAC token first
(`shared/relay-token.ts` on the server).

## State

- Server state is fetched per feature (small hooks, no global cache library).
- Client state is zustand: for example the builder (`builder/store.ts`: nodes, edges, selection, version), the run
  view (`live/run-view-store.ts`), and which builder panels are open (`builder/panels-store.ts`, kept in
  `localStorage` with safe fallbacks).
- The builder autosaves about 1 s after the last change; each save carries the version it was based on, so a newer
  save from another tab is never overwritten (409 "changed in another tab").

## UI conventions

- shadcn on **Base UI**: links inside buttons use `render={<Link />}` with `nativeButton={false}`, never `asChild`.
- Toasts with sonner; one id per kind of toast so they never stack.
- Colours come from theme tokens (light and dark); React Flow's colours are mapped to them in `builder/flow-theme.ts`.
- Formatting and lint: Biome (`bunx biome check --write <paths>`).
