import { sql } from "drizzle-orm";
import type { Db } from "../../../db";
import { RunStartError } from "./start-error";

/** What one user may start: runs a day, runs at once, runs one bot may start an hour, and a run's input size. */
export const RUN_LIMITS = { perDay: 500, concurrent: 5, perBotHour: 30, inputBytes: 256 * 1024 } as const;

/** Throws RunStartError when the user (or the bot) may not start another run right now. */
export async function checkCaps(db: Db, userId: string, botId: string | undefined) {
  // One query for all three counts. A run "active" for over 9 days is stuck, not running (see sweepStuckRuns).
  const result = await db.execute(sql`
    select
      count(*) filter (where created_at > now() at time zone 'utc' - interval '24 hours')::int as today,
      count(*) filter (
        where status in ('queued', 'running')
        and created_at > now() at time zone 'utc' - interval '9 days'
      )::int as active,
      count(*) filter (
        where started_by_bot_id = ${botId ?? null}
        and created_at > now() at time zone 'utc' - interval '1 hour'
      )::int as by_bot
    from workflow_run
    where user_id = ${userId}`);
  const counts = result.rows[0] as { today: number; active: number; by_bot: number };

  if (counts.today >= RUN_LIMITS.perDay) {
    throw new RunStartError("LIMIT", `You've reached ${RUN_LIMITS.perDay} runs in 24 hours.`);
  }
  if (counts.active >= RUN_LIMITS.concurrent) {
    throw new RunStartError("BUSY", `${RUN_LIMITS.concurrent} runs are already going. Wait for one to finish.`);
  }
  if (botId && counts.by_bot >= RUN_LIMITS.perBotHour) {
    throw new RunStartError("BOT_LIMIT", `This bot started ${RUN_LIMITS.perBotHour} runs in the last hour.`);
  }
}
