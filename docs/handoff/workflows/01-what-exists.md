# 01 — What already exists

Paths: backend files are relative to `apps/backend/src`, web files to `apps/web/src`.

## A. Sidebar trigger on every page (DONE)

`components/layout/page-header.tsx` exports `PageHeader` (a `SidebarTrigger` plus a title). It is used on the dashboard, avatar, mcp, skills, files, sandboxes, the vm page (`features/computer/components/vm/vm-page.tsx`), connect and workflow pages. Any new dashboard page must use it too.

## B. Composio (DONE, tested)

### Backend `modules/composio/`
| File | Purpose |
|---|---|
| `client.ts` | `composioFor(env)`: one cached `Composio` client per API key. `TOOLKIT_SLUG` regex. `rawClient()` reaches the raw API client, which keeps list cursors. Throws `ComposioNotConfigured` when `COMPOSIO_API_KEY` is missing (routes answer 503). |
| `catalog-sync.ts` | `syncCatalog`: pages `client.toolkits.list({limit:1000, sort_by:"usage", cursor})`, about 2 calls for 1,723 apps in ~3 s; upserts `composio_toolkit` and deletes stale rows. `catalogAge` is computed **in SQL, in UTC** (the timestamps are naive UTC). |
| `catalog-refresh.ts` | `ensureCatalog`: fills on the first view and refreshes in the background when older than `CATALOG_MAX_AGE_MS`. `refreshCatalog` is called by the daily cron in `scheduled.ts`. |
| `catalog-query.ts` | `searchCatalog` (escaped `ilike`, jsonb category filter, paging), `catalogCategories`, `isKnownToolkit`. |
| `session.ts` | `userSession(db, composio, userId)`: **one Composio session per user**, id saved in `user.composio_session_id`, with `manageConnections:false`. `connectCallback(webOrigin, toolkit)` is a FIXED URL (`/dashboard/connect?connected=…`), so there is no open redirect. |
| `connections.ts` | `listConnections`, `ownConnection` (ownership check), safe display fields only. |
| `errors.ts` | `composioError` → 503/502 JSON. |
| `routes.ts` | Under `/api/v1/composio` (check `src/routes.ts`): `GET /catalog?q&category&status&cursor`, `GET /categories`, `GET /connections` (userLimit), `POST /authorize {toolkit}` (userLimit; ignores any client `callbackUrl`), `DELETE /connections/:id` (owner only). Mounts `tools-routes`. |
| `tools.ts`, `tools-routes.ts` | `GET /toolkits/:toolkit/tools` → `ToolSummary[]` (slug, name, description, version). `GET /tools/:slug` → `ToolDetail` with `input`/`output` JSON Schemas. 1 h per-isolate cache (max 300 keys). Tool slug regex `^[A-Z0-9_]{1,120}$`. Gmail: 63 tools, 1.8 s cold, ~200 ms cached. |

DB: `db/schema/composio.ts` (table `composio_toolkit`: slug, name, description, logo, categories jsonb, toolsCount, triggersCount, noAuth, usage order). Migration `drizzle/0014_rapid_mentor.sql` (idempotent). Logos: `https://logos.composio.dev/api/<slug>`.

Tested: a callbackUrl injection is ignored; an unknown app gives 404; another user's connection gives 404; a bad slug gives 400; 20/min gives 429; the Connect Link opens the real Composio "connect to Gmail" page.

### Web `features/connect/`
`api.ts`, `use-catalog.ts` (infinite list), `use-connections.ts`, `use-connect-return.ts` (toast after an OAuth return), `use-categories.ts`, `category-label.ts` (acronyms such as CRM and AI), and these components:
- `app-logo.tsx`: a white tile with an initial as fallback when the image fails;
- `app-row`, `app-list`, `app-results`;
- `connect-toolbar` (search + category Select + status filter), `connect-intro`, `connect-page`;
- `connection-cell`, `connection-menu`, `disconnect-dialog`.

Page: `app/dashboard/connect/page.tsx` (Suspense + `ConnectPage`). Tested in light, dark and mobile.

## C. Workflow backend (DONE, tested)

### DB `db/schema/workflow.ts`, migration `drizzle/0015_fast_leper_queen.sql` (applied)
- `workflow`:
  - `id` (uuid text), `userId`, `name`, `description`;
  - `status` `draft|active|paused`;
  - `graph` (the draft), `publishedGraph`, `publishedVersion`;
  - `triggerKind`, `nextRunAt`, `webhookTokenHash`, `lastRunAt`, `createdAt`, `updatedAt`.
  - Indexes `(userId, updatedAt)` and `(status, nextRunAt)`.
- `workflow_run`:
  - `id`, `workflowId`, `userId`, `version`;
  - `trigger` `manual|test|schedule|webhook`;
  - `status` `queued|running|succeeded|failed|cancelled`;
  - `graph` (a snapshot that the run executes), `input`, `error`, `failedNodeId`;
  - `createdAt`, `startedAt`, `finishedAt`.
- `workflow_run_step`:
  - `id` identity, `runId`, `nodeId`, `nodeKind`;
  - `status` `running|retrying|succeeded|failed|skipped|waiting`;
  - `attempt`, `input`, `output`, `error`, `startedAt`, `finishedAt`.
  - **Unique `(runId, nodeId)`**: upsert one row per block per run.

### Graph `modules/workflows/graph/`
- `schema.ts` (zod; the web imports it):
  - `LIMITS`: nodes 50, edges 100, conditions 10, setFields 20, argBytes 20 000, minScheduleMinutes 5, maxDelaySeconds 7 d, maxAttempts 5, maxRetryDelaySeconds 3600.
  - Node kinds:
    - `trigger.manual`;
    - `trigger.schedule {every 1..1000, unit minutes|hours|days|weeks, timezone}`;
    - `trigger.webhook`;
    - `action.app {config:{toolkit, tool, version, arguments, connectedAccountId}, retry?:{maxAttempts, delaySeconds, backoff constant|exponential}, onError: stop|continue}`;
    - `logic.if` / `logic.filter {combine all|any, conditions[{left, op, right?}]}`;
    - `logic.delay {amount, unit seconds|minutes|hours|days}`;
    - `logic.set {fields[{key, value}]}`.
  - Ops: `equals, not_equals, contains, not_contains, gt, gte, lt, lte, exists, not_exists, is_true, is_false`.
  - Edge `{id, source, target, branch?: "true"|"false"}`. Only edges from `logic.if` carry a branch.
- `validate.ts`:
  - `topoOrder` (Kahn's algorithm; null on a cycle);
  - `structureIssues`, run on every save: duplicate ids, dangling edges, self-loops, edges into a trigger, branch only from If, duplicate edges, one trigger at most, **no cycles**;
  - `publishIssues`: a trigger exists; at least 2 nodes; every node reachable; app blocks have toolkit + tool + version; conditions are non-empty; delay ≤7 d; schedule ≥5 min.
  - `GraphIssue = {nodeId?, message}`.
- `triggers.ts`:
  - `triggerOf`;
  - `nextRunAt(trigger, from)` (rounded to a whole minute);
  - `hashToken` (sha-256 hex);
  - `newWebhookToken()` (32 random bytes, base64url, plus its hash).
- `graph.check.ts`: script `check:workflows` (passes).

### Store and routes
- `store/workflows.ts`: `MAX_WORKFLOWS=100` per user, `MAX_ACTIVE=25`, every query scoped to the user. `saveDraft` with `expectedUpdatedAt` returns 409 on a stale save. Also `countWorkflows`, `getWorkflow`, `setStatus`, `deleteWorkflow`.
- `store/runs.ts`: `statsByWorkflow`, `dailyRuns` (chart), `listRuns`, `getRun`.
- `routes/dto.ts` (`workflowDto` adds `hasWebhook`, `hasUnpublishedChanges`, `issues`), `routes/crud.ts`, `routes/lifecycle.ts`, `routes/index.ts`, mounted at `/api/v1/workflows` with `authGuard`:
  - `GET /` → `{items, daily}`; `POST /` `{name?}`; `GET/PUT/DELETE /:id` (PUT `{name?, graph?, expectedUpdatedAt?}`, uses `workflowSaveLimit`);
  - `POST /:id/publish`: re-validates; 422 with `issues`; 409 at MAX_ACTIVE; sets `publishedGraph`, version+1, `triggerKind`, `nextRunAt`; makes a webhook token once and returns it **once**;
  - `POST /:id/pause`; `POST /:id/webhook-token` (rotate);
  - `GET /runs/:runId`, `GET /:id/runs`.
- Rate limits in `wrangler.jsonc` + `config/env.ts` + `middleware/rate-limit.ts`: `RL` 100/min, `RL_WRITE` 20/min (`userLimit`), `RL_WF_SAVE` 60/min (`workflowSaveLimit`), `RL_WF_RUN` 10/min (`workflowRunLimit`, **exported, not used yet**: use it in 06).

Tested with curl: a loop gives 422; a stale save gives 409; publish works; cross-user access gives 404; an oversized graph gives 400.

## D. Workflow web — overview (DONE, tested)

- `features/workflows/`:
  - `api.ts`: `request()` and the call wrappers. Important: list/create use `request("")`, **not** `"/"`; the trailing slash gives a 404.
  - `types.ts`, `describe.ts` (human trigger text), `use-workflows.ts`.
- `components/status-badges.tsx`, and `components/overview/`: `stat-tiles`, `runs-chart` (14-day stacked succeeded/failed), `workflow-card`, `workflow-card-stats`, `workflow-card-menu`, `delete-workflow-dialog`, `workflows-overview`.
- Page `app/dashboard/workflow/page.tsx`. Create workflow navigates to `/workflows/${id}`.
- `proxy.ts` matcher includes `/workflows/:path*` (the auth redirect).

## E. Workflow web — builder (WRITTEN; tsc + Biome clean; NOT browser-tested) → see 02

All of these live in `features/workflows/builder/`:

| File | Purpose |
|---|---|
| `blocks.ts` | `Block`, `BlockBody` (distributive Omit), `BlockKind`, `newBlock`, `newBlockId` |
| `block-catalog.ts` | `BlockInfo`, `BUILT_IN` library entries, `infoOf` |
| `flow.ts` | `graphToFlow`, `flowToGraph`, flow types |
| `flow-rules.ts` | `wouldLoop`, `connectionProblem` (mirrors the server rules), `placeAfter` |
| `store-actions.ts` | `connect`, `addBlockTo` (pulled out of the store) |
| `store.ts` | zustand `useBuilder`: `workflow, nodes, edges, selectedId, version`, plus `load, setWorkflow, onNodesChange/EdgesChange/Connect, select, addBlock, updateBlock, removeBlock`. `version` is bumped only by changes that need saving. |
| `use-autosave.ts` | 900 ms debounce; PUT with `expectedUpdatedAt`; a 409 shows a conflict; a `beforeunload` guard; re-saves only after a success. Returns `{state, message}`. |
| `block-node.tsx`, `block-label.ts` | The custom React Flow node (+ `nodeTypes`); If has `true`/`false` source handles |
| `node-overlay.tsx` | `useRunOverlay` store (`steps: Record<nodeId, StepState>`) and `useNodeOverlay(id)` → ring, icon, issue. **The engine and relay must fill `useRunOverlay`.** |
| `flow-theme.ts` | xyflow CSS variables from theme tokens + `DRAG_TYPE` |
| `canvas.tsx` | ReactFlow: drop from the library, connection validation, select → settings |
| `library/library-panel.tsx`, `library-apps.tsx`, `library-item.tsx` | Floating left panel: built-ins + every app from `useCatalog`, with search; add by drag or click |
| `settings/*` | The floating right panel: `settings-panel`, `block-settings` (switch on kind), `trigger-settings`, `condition-settings`, `simple-settings` (Delay + Set), `app-settings` → `app-connection` (pick or connect the account), `action-picker`, `schema-form` + `schema-field` (forms built from the Composio JSON Schema), `retry-settings`, `data-references` (insertable `{{…}}` chips), `field`, `tools-api` |
| `use-publish.ts` | publish / pause / new webhook URL. `webhookUrl()` = `${BASE}/api/v1/hooks/:id/:token` (**route not built yet**, see 06) |
| `top-bar/*` | `top-bar.tsx` (back, name, status badge, save indicator, issues, `children` slot for Run, Turn on/Publish changes/Turn off, menu → New webhook URL), `name-input`, `save-indicator`, `issues-menu`, `webhook-dialog` (shown once) |
| `workflow-builder.tsx` | Shell: loads by id → loading / error / ready; `ReactFlowProvider` → `TopBar` + `<main>` with `Canvas`, `LibraryPanel`, `SettingsPanel` |

Routes: `app/workflows/layout.tsx` (`<AuthGuard/>` from `@/features/auth/components/auth-guard`; the path exists) and `app/workflows/[id]/page.tsx` (client, `useParams`, `<WorkflowBuilder key={id} id={id}/>`).
