# 09 — Later / backlog (do not start without the user's OK where noted)

## HTTP request block — APPROVED by the user
The spec is in `../agent-platform/05-http-request-block.md`.

## Composio app-event triggers ("when a new Gmail arrives")
Composio triggers: `composio.triggers.create(userId, slug, {connectedAccountId, triggerConfig})` plus a webhook subscription to our public endpoint, with signature verification. This needs a public URL (production, or a tunnel in dev). Add a node kind `trigger.app {toolkit, trigger, version, config, connectedAccountId}`, create/delete the Composio trigger on publish/pause, and route events → `startRun`. Respect the same caps. Read the `composio` skill for the current API.

## Other n8n/Zapier features (ideas, ordered by value)
1. "At a time" schedules (every day at 09:00 in a timezone): use `config.timezone`.
2. Templates gallery on the overview ("Email me a daily digest", …).
3. Duplicate workflow; version history (keep the last N `publishedGraph`s).
4. Paths / Switch (more than 2 branches), Loop over items (needs a per-run item cap, e.g. 100).
5. Run notifications: email the owner when a run fails (debounced, max 1 per hour per workflow).
6. Replay a failed run from the failed step.
7. An AI step that uses the project's own bots/agents (`modules/agent`).
