# 04 — Workflow Assistant: canvas lock and live updates

> **Status: DONE** (2026-11-11)
> - Done: `draft.updated` / `assistant.lock` events; lock column + `workflows/store/lock.ts` (stale locks cleared);
>   423 LOCKED on autosave PUT, import and publish (pause, runs and sharing stay allowed — they do not change the draft);
>   builder reloads the draft keeping the selection (`useBuilder.reload`), re-syncs on socket reconnect; while locked the
>   canvas cannot drag/connect/delete, the store refuses edits, autosave pauses, Delete block is disabled, and a banner
>   with **Stop** shows (`assistant/lock-banner.tsx`). Settings tabs stay readable (no disabled fieldset).
> - Done (follow-up): blocks the assistant adds pulse for 1.6 s (`useBuilder.fresh`, `block-node.tsx`) and are brought
>   into view only when they land off-screen (`assistant/follow.tsx`).

While the assistant works on a workflow, the user watches the canvas change and cannot edit it (product decision).
Test runs it starts show live exactly like manual test runs.

## Current mechanics (read)

- Builder state: `apps/web/src/features/workflows/builder/store.ts` (`useBuilder.load(workflow)` replaces the canvas).
- Autosave: `builder/use-autosave.ts` (PUT with `expectedUpdatedAt`; 409 → "conflict").
- Live socket per workflow: backend `workflows/live/*` (`WORKFLOW_LIVE` DO, `publishLive(env, workflowId, event)`,
  `LiveEvent` in `live/events.ts`); web `features/workflows/live/use-live-runs.ts`, `live-socket.ts`,
  `live-events.ts`. Runs already publish `run.started` / `step` / `run.finished` → canvas overlays update.

## 1. New live events (backend `workflows/live/events.ts`)

- [ ] Add to `LiveEvent`:
      ```ts
      | { type: "draft.updated"; updatedAt: string; by: "assistant"; at: string }
      | { type: "assistant.lock"; locked: boolean; runId: string; at: string }
      ```
      No graph in the event (keep events small and private); the builder refetches.
- [ ] Every assistant tool that saves the draft calls `publishLive(env, workflowId, { type: "draft.updated", … })`.
- [ ] The run publishes `assistant.lock` true at start and false at the end (every exit path).

## 2. Lock on the server (the real guard)

- [ ] Column `workflow.assistant_run_id uuid null` (or a small `workflow_lock` table). Set in the run's `start-run`
      step, cleared in its final step; the Stop route clears it too.
- [ ] `PUT /workflows/:id` (autosave, `routes/crud.ts`), `POST /:id/import`, publish/pause routes, run routes from
      the UI: when locked by an active run → `423 { error: "LOCKED", message: "The assistant is working on this
      workflow. Stop it to edit." }`. The assistant's own tools bypass the lock **only** for their run id.
- [ ] Stale lock safety: if the referenced `assistant_run` is not `queued|running`, treat as unlocked and clear it.

## 3. Builder behaviour (web)

- [ ] `use-live-runs.ts` (or a new `use-assistant-sync.ts` next to it): on `draft.updated`, `getWorkflow(id)` then
      `useBuilder.getState().load(w)`. Keep the current selection if the block still exists. Debounce 150 ms (several
      quick edits → one fetch).
- [ ] Do not re-trigger autosave after `load` (load sets `version: 0`; check `use-autosave.ts` `saved.current` so it
      does not PUT the same graph back — add a "loaded from server" guard if it does).
- [ ] On `assistant.lock`: put a flag in `useBuilder` (`lockedBy: runId | null`).
      - Canvas: `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable` stays true (user can look
        at settings), `deleteKeyCode={null}`.
      - Settings panel: inputs read-only (wrap the tabs in `<fieldset disabled>`), library add disabled, JSON import
        disabled, Turn on/Run disabled.
      - A slim banner at the top of the canvas: sparkle icon · "Assistant is building…" · **Stop** button (calls
        `POST /assistant/runs/:id/stop`).
- [ ] On page load, `GET /workflows/:id` returns `assistantRunId` (add to `workflowDto`) so a reopened page starts
      locked if a run is active.
- [ ] Animate newly added nodes briefly (e.g. ring pulse for 1.5 s) so the user sees what changed: diff node ids
      before/after `load`.
- [ ] `fitView` only when a node is added outside the viewport (don't jump around on every edit).

## Acceptance

- [ ] Assistant adds 3 blocks → they appear one by one without a page reload; the user's selection survives.
- [ ] While locked, dragging/typing is impossible; autosave makes no requests; Stop unlocks.
- [ ] Two tabs open on the same workflow both update and both show the lock.
- [ ] Closing the tab mid-run, reopening later → final canvas, unlocked.
