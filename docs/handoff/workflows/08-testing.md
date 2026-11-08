# 08 — Testing plan

The user wants real tests after building: run the app, click through it, look at screenshots. Type checks alone don't count.

## Static (every change)
```bash
cd apps/web && bun run check-types && bunx biome check src/features/workflows src/features/connect src/app/workflows
cd apps/backend && bunx tsc --noEmit && bun run check:workflows && bun run check:engine
# file size rule
cd apps/web && wc -l $(git ls-files -mo --exclude-standard src) | awk '$1>100 && $2!="total"'
cd apps/backend && wc -l $(git ls-files -mo --exclude-standard src) | awk '$1>100 && $2!="total"'
```
(Ignore `components/ui/*` and generated files.)

## API (curl with a session cookie)
Sign in once in agent-browser and export the cookie, or use the Better Auth sign-in endpoint with curl and `-c cookies.txt`. In zsh, quote variables; `for x in $var` does not word-split.

1. CRUD: create → get → save a graph → stale save → 409 → loop graph → 422 → 51 nodes → 400.
2. Publish without a trigger → 422 with issues; a valid one → 200; a webhook one returns `webhookToken` once (a second publish returns null).
3. Run: test run → 201 → poll `GET /runs/:id` until finished; steps exist; 11 runs in a minute → 429; 6 concurrent (use 6 delays of 1 min) → the 6th gives 429 BUSY.
4. Retry: an app block with bad arguments → fails at attempt 1 (fatal); with `onError: continue` → the run succeeds with a failed step.
5. Cancel during a delay → cancelled; the instance terminated (`bunx wrangler workflows instances describe workflow-run <id>` locally if supported).
6. Webhook: the matrix from 06c.
7. Schedule: set `next_run_at = now()` in SQL on an active scheduled workflow, trigger the cron twice → exactly one run.
8. Cross-user: user B on user A's run/cancel/live/run endpoints → 404.

## UI (agent-browser, light + dark, take screenshots and look at them)
The checklist in 02 step 5, plus:
- Build "Manual → Gmail: send email to myself → If (successful) → Slack/Gmail…" with a **real connected account** (ask the user to connect Gmail on the Connect page if none is connected; you cannot finish OAuth yourself). Run it and watch the live rings, then open the run in the drawer and check the inputs and outputs.
- Force a failure (a wrong recipient or a missing required field) → a red block, auto-selected, a readable error, a "Failed at …" banner.
- Delay 1 minute → hourglass + "resumes at"; leave the page and come back → the state is correct.
- The overview page reflects the runs (counts, chart, last status, Running dot).

## Cleanup at the end (ask the user before deleting anything that isn't clearly test data)
- Test users `k4-e2e-*@example.com`, `k4-ui-*@example.com`, plus their workflows/runs (they cascade).
- The Composio session/connections for `probe-user-readonly` and any test user.
- Scratch files in the session scratchpad.
