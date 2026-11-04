# Phase 2 Design Note

## Tools (sandbox, one file each in agent/tools/sandbox/)
- `sandbox_start({purpose})`: ensure one sandbox per bot. Returns existing if present.
- `sandbox_exec({command, cwd?, timeout_s?})`: run command as non-root. Default 120s, max 600s. Output capped 30k.
- `sandbox_read({path, offset?, limit?})`: read file with line numbers.
- `sandbox_write({path, content})`: write/overwrite file.
- `sandbox_edit({path, old, new})`: exact replace, fails if not unique.
- `sandbox_search({pattern, path?})`: ripgrep search.
- `sandbox_list({path})`: list directory.
- `sandbox_preview({port})`: returns public URL via getHost.
- `sandbox_stop()`: pause the sandbox.
- `sandbox_list_all()`: list user's sandboxes.
- `sandbox_delete({bot_id})`: delete (requires approval for other bots' sandboxes).

## Harness loop
1. Bot receives task → explores (list/search/read) → plans (todos) → edits (sandbox_edit) → tests (sandbox_exec) → verifies → summarizes.
2. Sub-agents mandatory for tasks touching ≥3 files or ≥2 independent parts.

## Context strategy
- Reuse existing summarization at 80%.
- Todo guard enforces completion + verification.
- Sub-agent results saved in subagents/<group>/ in workspace.

## Sandbox lifecycle state machine
- States: creating → running → paused → error
- ensure(): resume if exists, else create (check limit first)
- Pause: only when idle (no working bot, no editor socket, idle > SANDBOX_IDLE_MINUTES)
- Alarm every 30s checks pause condition
- Cron safety net: pause running sandboxes with no activity for 2× idle
- Daily minutes cap per user (SANDBOX_MAX_MINUTES_PER_DAY)

## Data model
- Table `bot_sandbox`: bot_id PK, user_id, sandbox_id, status, purpose, template, created_at, last_used_at, last_activity_at
- Env: SANDBOX_MAX_PER_USER (3), SANDBOX_IDLE_MINUTES (10), SANDBOX_TEMPLATE (base), SANDBOX_MAX_MINUTES_PER_DAY (240)

## Durable Object: BotSandbox
- One per bot (name = bot id), owns E2B sandbox
- Layers: state → lifecycle → exec → files → meter → alarm (≤100 lines each)
- ensure(purpose), pause(), resume(), exec(), readFile(), writeFile(), editFile(), search(), list(), preview(), stop(), delete()
- Editor WebSocket keeps sandbox alive (never pause while connected)

## UI map
- Workspace side bar: "Sandbox" section (status, purpose, last used, Start/Pause/Delete)
- Global page: app/dashboard/sandboxes/page.tsx (table of all sandboxes)
- Code editor: full-screen dialog with file tree, editor, terminal, preview
- Approval UI: sandbox_delete shows owner, purpose, created/last used

## Async sub-agents
- SubagentTaskRegistry DO (one per parent thread): SQLite tasks table
- SubagentTaskWorkflow: runs one sub-agent in slices, writes to registry + R2
- Tools: start_async_task, check_async_task, update_async_task, cancel_async_task, list_async_tasks
- Limits: 6 concurrent, 20/day/user

## Dynamic sub-agents
- Spike: @langchain/quickjs on Workers. If yes → coding bot only, cap at maxSubagents. If no → STOP and report.

## Coding bot role
- All default features + sandbox tools + async/dynamic sub-agents
- Prompt: explore before editing, plan with todos, small edits, run tests, verify, summarize
- Mandatory sub-agents for tasks touching ≥3 files or ≥2 independent parts