# 03 — The execution engine (Cloudflare Workflow)

## Why a Cloudflare Workflow

The repo already uses them: `ChatRunWorkflow` and `AsyncTaskWorkflow` (look at `modules/async-tasks/workflow.ts` for the pattern). A Cloudflare Workflow gives:
- durable steps (each `step.do` result is saved; a crash resumes after the last finished step);
- built-in retry with backoff per step;
- `step.sleep` for up to 365 days, free while waiting (waiting instances do not count toward concurrency);
- 10 000 steps per instance;
- `NonRetryableError` to stop a step's retries.

Docs: https://developers.cloudflare.com/workflows/ (read "Rules of Workflows" and "Sleeping and retrying" before you start).

## Files to create (`apps/backend/src/modules/workflows/engine/`, each ≤100 lines)

| File | Contents |
|---|---|
| `runner.ts` | `export class WorkflowRunner extends WorkflowEntrypoint<Env, RunParams>`: the main loop |
| `params.ts` | `type RunParams = { runId: string; workflowId: string; userId: string }`. **Pass only ids.** Load the graph from `workflow_run.graph` inside a step, so the payload stays small and the run executes exactly the snapshot taken at start. |
| `plan.ts` | Pure: given the graph + the outcomes so far, which nodes are ready, skipped or done. Uses `topoOrder`. |
| `execute-block.ts` | Switch on `node.kind` → the right handler; returns `{output}` or throws |
| `blocks/app.ts` | Composio action handler |
| `blocks/logic.ts` | If / Filter / Set handlers (they call 04's pure functions) |
| `step-log.ts` | DB writes: `markStep(runId, node, patch)` (upsert on `(runId,nodeId)`), `markRun(runId, patch)` |
| `events.ts` | `emit(env, runId, event)` → the run relay (see 05) |
| `errors.ts` | `classify(e)` → retryable vs fatal; `userMessage(e)` → a short readable text, never secrets |

Register it:
- `wrangler.jsonc` → `"workflows"`: add `{ "name": "workflow-run", "binding": "WORKFLOW_RUN", "class_name": "WorkflowRunner" }`
- `src/index.ts` → `export { WorkflowRunner } from "./modules/workflows/engine/runner";`
- `config/env.ts` → `WORKFLOW_RUN: Workflow<RunParams>` (match how `CHAT_RUN`/`ASYNC_TASK` are typed there)
- If `worker-configuration.d.ts` is generated, run `bunx wrangler types`.

## Run lifecycle

```
POST /workflows/:id/run (06)            → insert workflow_run {status:"queued", graph snapshot, input, trigger}
                                         → env.WORKFLOW_RUN.create({ id: runId, params: {runId, workflowId, userId} })
WorkflowRunner.run():
  step.do("start")                      → load the run; if it is not queued/running (e.g. cancelled) → return
                                           mark run running, startedAt; emit run.started
  ctx = { trigger: run.input, steps: {} }   // outputs by nodeId; rebuilt from step results (durable)
  for each node in topoOrder(graph):
     if the node is not reachable along taken edges → markStep skipped; emit; continue
     if cancel was requested → mark run cancelled; return
     switch kind:
       trigger.*      → output = run.input ?? {}; mark succeeded (no external call)
       logic.delay    → markStep waiting; emit; await step.sleep(`delay:${id}`, ms); mark succeeded
       logic.if       → result = evaluate(conditions, ctx); output = {result}; the taken branch = String(result)
       logic.filter   → pass = evaluate(...); if !pass → mark succeeded {passed:false}, and every node downstream only via it is skipped
       logic.set      → output = Object.fromEntries(fields.map(f => [f.key, resolve(f.value, ctx)]))
       action.app     → output = await step.do(`app:${id}`, retryConfig(node), () => runApp(...))
     ctx.steps[id] = { output }
  mark run succeeded/failed; workflow.lastRunAt = now; emit run.finished
```

### Rules that make this durable and correct
- **Every side effect goes inside `step.do`**: DB writes, Composio calls, relay emits. Code outside steps re-runs on every resume. Give steps **deterministic, unique names** (`app:${nodeId}`, `log:${nodeId}:start`). No `Date.now()` or random values outside steps; return them from a step if needed.
- Keep step return values small (they are stored; the limit is 1 MiB per step). Truncate outputs: store at most **64 KB of JSON per step output** in the DB and in the ctx. For larger values, keep a preview plus `{truncated:true}`.
- Branch reachability: a node runs only if at least one incoming edge is "taken". An edge is taken when its source succeeded and (it has no branch, or the branch equals the If result), and the Filter source passed. A source that failed with `onError: continue` counts as succeeded with `output: {error}`. Nodes with no taken incoming edge → `skipped`. Put this in `plan.ts` as a pure function and test it in 04's check script.
- Several branches can be ready at the same time. **Run them in topo order, one by one** (simple, predictable, easy to show on the canvas). Parallel branches are a later optimisation; do not do it now.

### Retry and on-error (per block, the user agreed)
```ts
// retryConfig(node) — only action.app blocks have retry
const r = node.retry ?? { maxAttempts: 1, delaySeconds: 10, backoff: "exponential" };
{ retries: { limit: r.maxAttempts - 1, delay: `${r.delaySeconds} seconds`, backoff: r.backoff }, timeout: "2 minutes" }
```
- Inside the step: before calling Composio, `markStep(status: attempt>1 ? "retrying" : "running", attempt)` and emit. The attempt number: keep a counter in the DB row (increment in SQL: `attempt = attempt + 1` on conflict). Do not use an in-memory counter, because a retry re-executes the callback.
- Throw `NonRetryableError` (from `cloudflare:workflows`) for errors that retrying cannot fix: 400/401/403/404/422 from Composio, invalid arguments, a missing or foreign connection, schema validation. Retry on network errors, 429 and 5xx.
- After the final failure, `step.do` throws. Catch it **outside** the step:
  - `onError: "stop"` → markStep failed (error = `userMessage(e)`); run failed, `failedNodeId = node.id`, `error`; emit; stop.
  - `onError: "continue"` → markStep failed but the run continues; `ctx.steps[id] = { output: null, error: msg }`.

### Composio action (`blocks/app.ts`)
1. `args = resolveDeep(node.config.arguments, ctx)` (04). The size cap is 20 KB, already validated at save; check again after resolving: ≤100 KB.
2. **Ownership check at run time**: the `connectedAccountId` must belong to `userId` and be ACTIVE. Use `ownConnection` from `modules/composio/connections.ts`. If the block has no `connectedAccountId`, use the user's single active connection for that toolkit. With several connections, fail with "Choose which <App> account to use". Fatal.
3. Execute as the owner with the **pinned version**:
   ```ts
   const composio = composioFor(env);
   const res = await composio.tools.execute(node.config.tool, {
     userId, connectedAccountId, arguments: args, version: node.config.version,
   });
   // res: { data, successful, error } — when !successful → throw (classify by error text/status)
   ```
   Check the exact `execute` signature in `@composio/core` 0.28 (`node_modules/@composio/core/dist/*.d.ts`) before writing it. Use the `composio` skill for docs. Composio refuses execution without a version unless `dangerouslySkipVersionCheck` is set: **do not skip it**.
4. Output = `res.data`, truncated to 64 KB.

### Cancel
`POST /workflows/runs/:runId/cancel` (06) sets `workflow_run.status = "cancelled"` (only from queued/running) and calls `instance = await env.WORKFLOW_RUN.get(runId); await instance.terminate()`. Wrap it in try/catch, because a finished instance throws. The runner also checks the DB status between blocks (inside a step) as a backup.

### Run-level caps (checked in 06 before `create`, see 07)
- Duration: the runner gives up after **8 days** of wall time (7 d max delay plus margin). Compare `startedAt` (read in a step) to now (from a step).
- Steps per run ≤ `LIMITS.nodes` (50) is guaranteed by the schema, since there are no loops.

### Stuck runs
In the daily cron, mark runs `running` for >9 days as failed ("Timed out"). Also mark runs `queued` for >10 min as failed ("Could not start").

## Done when
- A manual workflow Trigger → Set → If → Gmail(send to self) runs end to end; `workflow_run_step` has a row per block with input/output; the run is succeeded.
- An invalid argument gives a fatal error (no retries); a temporary network error gives retries visible in `attempt`; `onError: continue` keeps going.
- A Delay of 1 minute shows `waiting`, then continues.
- Cancel during a delay stops the run.

## Added after the user's later decisions
- **Block handlers to add:** `action.http` (`../agent-platform/05`), and `ai.bot` only if the user confirms it (`../agent-platform/06`).
- **Secrets:** the context gets a `secrets` provider (decrypts the owner's `user_secret` on demand). Every decrypted value goes into a per-run redaction set, applied to every step input/output, error, event and log **before** it is stored or published (`../agent-platform/03` §A).
- **Run triggers:** `workflow_run.trigger` also takes `"bot"` (and `"workflow"` if `ai.bot` exists). Add `started_by_bot_id`, `thread_id`, `depth` (`../agent-platform/02` §4). `startRun` refuses depth > 2.
- Re-validate the run's graph with `graphSchema` + `structureIssues` at the start of the run (the trust boundary: `../01-security.md` §2.5).
