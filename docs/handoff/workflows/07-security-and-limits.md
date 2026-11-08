> The project-wide rules and the full limits table are in `../01-security.md` (it wins on any conflict). This file lists the workflow-specific checks and their status.

# 07 — Security and limits (one table; the user agreed to these limits)

| Area | Rule | Where | Status |
|---|---|---|---|
| Ownership | Every workflow/run/step/connection query filters by `userId`; a foreign id → 404, never 403 | `store/*`, `connections.ts` | done for CRUD; **apply to runs/cancel/live** |
| Graph size | ≤50 nodes, ≤100 edges, ≤10 conditions, ≤20 set fields, args ≤20 KB | `graph/schema.ts` | done |
| No loops | Cycles refused on every save (server) + blocked in the UI | `validate.ts`, `flow.ts` | done |
| Workflows per user | ≤100 total, ≤25 active | `store/workflows.ts` | done |
| Save rate | 60/min/user | `RL_WF_SAVE` | done |
| Concurrency on save | `expectedUpdatedAt` → 409 | `saveDraft` | done |
| Run start rate | 10/min/user (manual/test) | `RL_WF_RUN` | **wire in 06a** |
| Runs per day | ≤500/user/24 h (all triggers) | `startRun` | todo |
| Concurrent runs | ≤5 queued+running per user | `startRun` | todo |
| Schedule | ≥5 min interval; missed runs not backfilled; atomic claim | schema + `schedule.ts` | partly |
| Delay | ≤7 days per block; run gives up after 8 days | schema + runner | partly |
| Retry | ≤5 attempts, ≤3600 s delay; fatal errors never retried | schema + runner | partly |
| Step timeout | 2 min per Composio call | runner | todo |
| Data size | input ≤256 KB; step output stored ≤64 KB; resolved args ≤100 KB; template depth ≤10 | runner / template | todo |
| Templates | No eval; path segments regex; refuse `__proto__/prototype/constructor` | `template.ts` | todo |
| Composio | Execute only as the owner, with an owned ACTIVE connection, a pinned version, never `dangerouslySkipVersionCheck` | `blocks/app.ts` | todo |
| OAuth callback | Fixed server-side URL; client `callbackUrl` ignored | `session.ts` | done |
| Webhook secret | 256-bit token, only its sha-256 stored, shown once, rotatable, constant-time compare, 404 on any mismatch | `triggers.ts`, `hooks.ts` | token done; **route todo** |
| Webhook abuse | 60/min per workflow (`RL_WF_HOOK`), 256 KB body, JSON only, headers allowlisted | `hooks.ts` | todo |
| Live socket | Owner-only upgrade; events carry no input/output; ≤20 sockets per workflow | `run-relay.ts` | todo |
| Errors to users | Short readable text; never raw stack traces, API keys or tokens (strip `Bearer …`, keys matching `/[A-Za-z0-9_-]{32,}/` in messages) | `errors.ts` | todo |
| Logs | `console.error` with runId/nodeId, never argument values | engine | todo |
| Deletion | Deleting a workflow cascades runs/steps (FK). Also terminate active instances first | `crud.ts` DELETE | **add terminate** |
| Pause | Pausing stops the schedule (`nextRunAt=null`) and makes the webhook 404; running runs finish (state this in the UI) | lifecycle | done; add UI copy |
| Account delete | User delete cascades the `workflow` rows; also delete the user's Composio connections (check whether the existing delete-account flow does) | auth | check |
