/** How the schedule fields are explained to the bot (agent/tasks/tools.ts). */
export const SCHEDULE_HELP =
  'mode "once" (date YYYY-MM-DD + at HH:MM), "daily" (at), "weekly" (days 0=Sunday…6 + at), "monthly" (dayOfMonth 1-31 + at; 31 = last day), or "every" (every N unit, at least 1 hour). timezone is an IANA name (e.g. "Asia/Dhaka"): ask the user if you do not know theirs.';

/** The message a scheduled task posts in its chat each time it runs (tasks/start.ts). */
export const taskMessage = (title: string, prompt: string) => `⏰ Scheduled task “${title}”\n\n${prompt}`;
