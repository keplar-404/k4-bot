# 06 — Starting runs: manual/test, schedule, webhook

All three paths call one function: `startRun(env, db, {workflow, trigger, graph, input})` in `modules/workflows/engine/start.ts`. It:
1. **checks the caps** (07): daily runs, concurrent runs, workflow status;
2. inserts `workflow_run` (`id = crypto.randomUUID()`, `status: "queued"`, `version`, `graph` snapshot, `input` truncated to 256 KB);
3. `await env.WORKFLOW_RUN.create({ id: runId, params })`. If that throws → mark the run failed ("Could not start") and rethrow as 503;
4. returns the run.

Caps query (one SQL round trip):
```sql
select
  count(*) filter (where created_at > now() - interval '24 hours')            as day,
  count(*) filter (where status in ('queued','running'))                       as active
from workflow_run where user_id = $1
```
If `day >= 500` → 429 `RUN_LIMIT` ("You've reached 500 runs today."). If `active >= 5` → 429 `BUSY` ("5 runs are already going. Wait for one to finish.").
Race note: two requests can both pass the check. That is acceptable at this scale (the over-run is ≤ the request concurrency). A Postgres advisory lock per user (`pg_advisory_xact_lock(hashtext(user_id))`) would be stricter; use it only if Neon's HTTP driver supports transactions here (check `createDb`).

## 06a — Manual and test run (authenticated)

`modules/workflows/routes/runs.ts`, chained into `routes/index.ts` **before** `.route("/", crud)`:
- `POST /:id/run` with `workflowRunLimit` (10/min/user) + `validate("json", z.object({ mode: z.enum(["live","test"]).default("test"), input: z.unknown().optional() }))`
  - `test`: runs the **draft** `graph`. It must pass `publishIssues` (else 422 with `issues`). Allowed in any status. `trigger: "test"`.
  - `live`: only when `status === "active"` and the trigger is manual; runs `publishedGraph`. `trigger: "manual"`.
  - `input` must be valid JSON ≤ 256 KB (check `JSON.stringify(input).length`). For a test of a webhook workflow it becomes `{ body: input, headers: {} }`; for a schedule test, `{ scheduledAt: now }`.
  - Response `201 { run }`.
- `POST /runs/:runId/cancel` (`userLimit`): user-scoped update `where status in ('queued','running')`, then terminate the instance (03). 404 if not the owner.
- `GET /:id/runs?limit=20&cursor=` (exists; add paging if missing).

## 06b — Schedule trigger (cron + DB scan)

Cloudflare allows only a few cron triggers per Worker, so use **one per-minute cron that scans the DB**, not a cron per workflow.
- `wrangler.jsonc` → `"triggers": { "crons": ["0 3 * * *", "* * * * *"] }`
- `scheduled.ts`: branch on `controller.cron`. `"0 3 * * *"` keeps today's daily jobs (plus the stuck-run sweep from 03). `"* * * * *"` → `ctx.waitUntil(runDueSchedules(env))`.
- `modules/workflows/engine/schedule.ts` → `runDueSchedules`. **Claim atomically**, so two overlapping cron runs never double-fire:
  ```sql
  update workflow set next_run_at = <computed next>, last_run_at = now()
  where id = $id and status = 'active' and next_run_at = $seenNextRunAt
  returning *
  ```
  Steps:
  1. `select id, user_id, published_graph, next_run_at from workflow where status='active' and trigger_kind='trigger.schedule' and next_run_at <= now() order by next_run_at limit 100`
  2. For each: compute `next = nextRunAt(trigger, max(now, seenNextRunAt))`. If the run is late by more than one interval (the worker was down), **skip the missed runs**; don't backfill. Claim with the update above; if 0 rows → someone else took it.
  3. `startRun(... trigger:"schedule", graph: published_graph, input:{scheduledAt: seenNextRunAt})`. Cap errors → log, and record a failed run with the message, so the user sees "Skipped: daily limit reached" in history.
  4. Use `Promise.allSettled`, with a concurrency of 10.
- `timezone` exists in the schema, but intervals don't need it. Leave it for later "every day at 9:00" schedules (see 09).

## 06c — Public webhook route

URL format (already shown to users by `use-publish.ts`): `POST {BASE}/api/v1/hooks/:workflowId/:token`.

`modules/workflows/routes/hooks.ts`, mounted in `src/routes.ts` at `/hooks`, with **no `authGuard`** and no cookies.
1. `validate("param", z.object({ id: z.uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }))`. Bad shape → **404** (never say which part was wrong).
2. Rate limit before the DB: add a binding `RL_WF_HOOK` (namespace `1005`, 60 per 60 s) keyed by `workflowId`. Optionally a second key by `cf-connecting-ip`. Over the limit → 429.
3. Body: require `content-type: application/json`; read at most **256 KB** (check `content-length` and also the actual length read), else 413. Invalid JSON → 400.
4. Load `workflow` by id (no user scope; this is the public path). Missing, not active, `trigger_kind !== 'trigger.webhook'`, or no hash → 404.
5. Compare `await hashToken(token)` with `webhookTokenHash` in **constant time** (compare two equal-length hex strings with an XOR loop, or `crypto.subtle.timingSafeEqual` if available in workerd). A mismatch → 404.
6. Input = `{ body, headers: pick(req.headers, ["content-type","user-agent","x-request-id"]), receivedAt }`. **Never store `authorization` or cookies.**
7. `startRun(... trigger: "webhook", graph: publishedGraph)`. A cap error → 429 with a JSON message. Success → `202 { runId }`. Don't wait for the run.
8. CORS: none needed (server-to-server). Respond with JSON.
9. Loop protection: a workflow whose Composio action calls its own webhook URL would loop through the outside world. The daily (500) and concurrent (5) caps bound it. Also refuse when the request has header `x-k4-workflow-run` equal to a run of the **same** workflow, and set that header on any outgoing HTTP the engine makes later (09).

## Done when
- Test run from the builder works for all three trigger kinds.
- A schedule every 5 minutes fires within about 1 minute of due, exactly once per interval, even with two dev cron invocations (call the scheduled handler twice at once with `wrangler dev --test-scheduled` and `curl "http://localhost:<port>/__scheduled?cron=*+*+*+*+*"`).
- The webhook: a correct token → 202 plus a run; a wrong token, a paused workflow or an unknown id → 404; 300 KB → 413; 61 calls/min → 429; rotating the token kills the old URL.
