# Scheduled tasks

Like Grok's Tasks: a bot does something at times you choose ("every weekday at 8, send me the AI news"; "on the 1st of
each month, summarise last month's invoices"; "remind me on Friday at 17:00").

## How it works

- A task is a row in `scheduled_task`: bot, title, prompt, schedule, status, next run, last problem.
- At each due time the per-minute cron (`modules/tasks/due.ts`) claims the task, moves its next run ahead, and starts it
  (`modules/tasks/start.ts`): the prompt is sent as a **new message in the bot's chat** (the conversation the chat page
  opens), exactly as if you had typed it, marked "⏰ Scheduled task". So:
  - you watch it work live in the chat;
  - the bot has all its tools and the conversation so far;
  - in Ask mode, actions it wants to take wait for your approval in the chat.
- If the bot is still answering something else, that run is skipped and the task shows why; it tries again at the next
  time. A late run is not made up. A "once" task turns itself off after it runs.

## Why tasks are not workflows

A workflow's "Ask a bot" step is headless (no chat) and read-only by design, which is right for automations but not for
"do this for me". Tasks reuse the full chat run instead. Both share one schedule engine (`modules/schedules`).

## Schedules

| Mode | Fields | Example |
|---|---|---|
| `once` | `date` (YYYY-MM-DD), `at` (HH:MM) | 2026-12-24 at 18:00 |
| `daily` | `at` | every day at 07:30 |
| `weekly` | `days` (0 = Sunday … 6), `at` | Mon, Wed, Fri at 09:00 |
| `monthly` | `dayOfMonth` (1–31; 31 = the last day of shorter months), `at` | the 1st at 08:00 |
| `every` | `every`, `unit` (minutes, hours, days, weeks) | every 6 hours |

Times are wall-clock times in `timezone` (an IANA name such as `Asia/Dhaka`), so 09:00 stays 09:00 when clocks change.
New schedules default to the browser's time zone. Tasks run at most once an hour.

## Creating tasks

- **Tasks page** (`/dashboard/tasks`): create, edit, turn on/off, run now, open the bot's chat, delete.
- **In chat:** ask the bot ("every morning at 8, send me the weather in Dhaka"). It calls `schedule_task` (asks first
  in Ask mode); `list_scheduled_tasks` and `change_scheduled_task` manage them later.

## Limits

20 tasks per user; at most hourly; every run counts toward the daily chat limits (runs and tokens), like a message you
send. API: [Tasks](../reference/api.md#tasks).
