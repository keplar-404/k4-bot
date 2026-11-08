# 05 — Real time: live run state on the canvas

Goal: while a run is going, the user watches it move through the canvas:
- a blue spinner ring on the running block;
- amber "retrying 2/3";
- an hourglass for a delay, with "resumes at 14:05";
- green check / red X;
- grey for skipped.

On failure, the failing block is red, selected, and its error is shown. **The DB is the source of truth; the socket only makes it instant.**

## Backend: a run relay Durable Object

Copy the chat relay pattern, but much smaller (no seq, no replay table). Reference: `modules/chat/relay/index.ts` (`ChatRelayDurableObject`, uses `ctx.acceptWebSocket` = hibernation), `access.ts` (`checkConnect`: token check), `sockets.ts` (`broadcast`), and `modules/chat/run/relay.ts` (`publishEvent` with the `x-internal-secret` header).

`modules/workflows/live/run-relay.ts`: `export class WorkflowRunRelay extends DurableObject<Env>`, one instance **per workflow** (`idFromName(workflowId)`), so the builder holds one socket for all runs of that workflow.
- `fetch /connect` (WebSocket upgrade): authenticate. Either reuse `checkConnect` with a token, or have the main worker route verify the session (`authGuard`) and that the workflow belongs to the user, then forward the upgrade to the DO. **Prefer the latter**: the Worker route `GET /api/v1/workflows/:id/live` runs `authGuard` + `getWorkflow(db, userId, id)` (404 if not the owner), then `return stub.fetch(c.req.raw)`. Check how chat does WebSocket auth (cookies on WS upgrade vs a token query param, `WS_TOKEN_SECRET`) and do the same, because cross-origin cookies may not be sent.
- `fetch /publish` (POST, internal only: compare the `x-internal-secret` header like `isInternal`): broadcast the JSON to all sockets. No storage.
- Hibernation: `ctx.acceptWebSocket(ws)`; implement `webSocketClose` like the chat relay. Cap: ≤ 20 sockets per workflow (close the oldest).
- Register in `wrangler.jsonc` → `durable_objects.bindings` `{ "name": "WORKFLOW_LIVE", "class_name": "WorkflowRunRelay" }`, **plus a migration entry** (see how the existing DOs are listed under `"migrations"` in `wrangler.jsonc`; add a new tag with `new_sqlite_classes` or `new_classes`, matching the existing style). Export it from `src/index.ts` and type it in `config/env.ts`.

Event shapes (`modules/workflows/live/events.ts`, shared with the web through `@backend/...` types):
```ts
type LiveEvent =
  | { type: "run.started";  runId: string; trigger: string; at: string }
  | { type: "step";         runId: string; nodeId: string; status: StepStatus; attempt: number; error?: string; resumeAt?: string; at: string }
  | { type: "run.finished"; runId: string; status: "succeeded"|"failed"|"cancelled"; failedNodeId?: string; error?: string; at: string };
```
**No step input/output in events** (they may hold private data and can be large). The UI fetches them on demand from `GET /runs/:runId`.

The engine's `emit()` runs inside a `step.do` and never throws: log the error and carry on, so a relay outage does not fail runs.

## Backend: run detail endpoint (exists, extend it)
`GET /workflows/runs/:runId` must return the run plus all `workflow_run_step` rows (`input`, `output`, `error`, `attempt`, times), user-scoped. Verify that `getRun` in `store/runs.ts` returns the steps; add them if not. Add `POST /workflows/runs/:runId/cancel` (06).

## Web

`features/workflows/live/` (or `builder/runs/`):
| File | Purpose |
|---|---|
| `use-live-runs.ts` | Opens `wss://…/api/v1/workflows/:id/live` while the builder is open. Reconnects with backoff (1 s, 2 s, 5 s, max 30 s). On every (re)connect, refetch `GET /:id/runs?limit=1` plus the active run's detail, so missed events don't matter. Updates the store below. |
| `run-view-store.ts` | zustand: `activeRunId`, `viewedRunId`, `runs` (list), `detail` (run + steps). On a `step` event for `viewedRunId` → update `useRunOverlay.set({...steps, [nodeId]: status})`. |
| `runs-drawer.tsx` | From 02. The history list; "Live" pill; click → `viewedRunId` |
| `run-steps.tsx` | Inside the drawer: the blocks in run order with status, duration, attempts, error; click → select the node on the canvas |
| `step-io.tsx` | In the settings panel when a run is being viewed: a "Last run" tab with input/output as collapsible JSON (`<pre>` with max height, copy button) |
| `run-banner.tsx` | A floating pill over the canvas: "Running · step 3 of 6 · Gmail: Send email" or "Failed at Slack: Send message — channel_not_found [View]" or "Succeeded in 4.2 s"; with Cancel while running and Clear to exit run view |

`node-overlay.tsx` already maps `StepState` → ring + icon. Extend `block-node.tsx` to show:
- a small second line while retrying ("Retry 2 of 3");
- "Waits until 14:05" while waiting;
- the error text (truncated to one line) when failed.

When a run fails, auto-select `failedNodeId` and `fitView` to it.

Polling fallback: if the socket can't connect after 3 tries, poll `GET /runs/:runId` every 2 s while a run is active.

## Overview page
`workflow-card-stats` already shows the last status. After the engine exists, check that `statsByWorkflow` and the chart read real data. Add a "Running" dot on cards with an active run (from the list endpoint: include `activeRuns` in the stats).

## Done when
- Run in tab A and watch tab B: both canvases update within about 1 s.
- Kill the network mid-run, then restore it: the state catches up correctly.
- A failed run highlights the right block with the readable error, and the "Last run" tab shows the input sent to Composio and the error output.
