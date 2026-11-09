# Limits

Every cost path has a per-user ceiling. Values are defaults; those with a variable can be changed in
[Configuration](configuration.md). Daily counters reset at 00:00 UTC unless "24 hours" is stated.

## Chat and agents

| Limit | Default | Where |
|---|---|---|
| Tokens per user per day (paid models) | 2,000,000 (`MAX_DAILY_TOKENS_PER_USER`) | `chat/threads.ts` |
| Chat runs per user per day | 50 (`MAX_RUNS_PER_USER`) | `chat/threads.ts` |
| Output tokens per model reply | 8,192 (`MAX_OUTPUT_TOKENS`) | |
| Agent steps per slice / slices per run | 60 / 300 (`RUN_SLICE_STEPS`, `MAX_RUN_SLICES`) | `chat/run` |
| Model retries per run | 10 (5 s doubling to 5 min) | `chat/run/types.ts` |
| Waiting for an answer or approval | 7 days | `chat/run` |
| Background task | 15 minutes, 80 steps | `async-tasks` |
| Images generated per day | 20 (`MAX_IMAGES_PER_DAY`) | |
| OCR pages per day | 50 (`MAX_OCR_PAGES_PER_DAY`) | |
| Storage per user / per file | 1 GB (`MAX_STORAGE_MB_PER_USER`) / 25 MB | `files` |

## Computer and sandboxes

| Limit | Default |
|---|---|
| Computer time per user per day | 120 min (`COMPUTER_MAX_MINUTES_PER_DAY`) |
| One computer session | 20 min (`COMPUTER_SESSION_MINUTES`), warned 5 min before (`COMPUTER_WRAP_MINUTES`) |
| Idle pause | 5 min (`COMPUTER_IDLE_MINUTES`) |
| Screen actions per agent run | 400 (`COMPUTER_MAX_ACTIONS_PER_RUN`) |
| Sandboxes per user | 3 (`SANDBOX_MAX_PER_USER`) |
| Sandbox time per user per day | 240 min (`SANDBOX_MAX_MINUTES_PER_DAY`) |
| Sandbox idle pause | 10 min (`SANDBOX_IDLE_MINUTES`) |

## Workflows

| Limit | Value |
|---|---|
| Workflows per user / on at once | 100 / 25 |
| Blocks / connections per workflow | 50 / 100 |
| Runs per user | 500 per 24 hours, 5 at once |
| Runs started by one bot | 30 per hour |
| Workflows created by one bot | 10 per day |
| Run input | 256 KB |
| Schedule interval | ≥ 5 minutes |
| Delays in one run | 7 days in total |
| For each | ≤ 100 items, ≤ 300 block runs, one per workflow |
| "Ask me first" wait | 1–168 hours |
| AI steps | 100 per user per 24 hours, 5-minute timeout, 10 knowledge files |
| Block retries | ≤ 5 tries, ≤ 1 hour between |
| Stored block output | 64 KB (marked `truncated`) |
| Filled-in fields | 100 KB, 50 references per field |
| HTTP block | 1–30 s timeout |
| Self-triggering app-event workflow | turned off after 30 runs in 5 minutes |

## Scheduled tasks

20 per user, at most once an hour.

## Rate limits (per minute)

| Namespace | Limit | Key |
|---|---|---|
| `RL` | 100 | IP, every API request |
| `RL_WRITE` | 20 | user, mutating or costly routes |
| `RL_WF_SAVE` | 60 | user, workflow autosave |
| `RL_WF_RUN` | 10 | user, runs started by hand |
| `RL_WF_HOOK` | 60 | workflow, webhook and app-event runs |
| `RL_APP_EXEC` | 30 | user, Composio actions |
| `RL_HTTP` | 30 | user, HTTP blocks |
| Better Auth | sign-in 5, sign-up 3, reset 3, other 100 | IP |
