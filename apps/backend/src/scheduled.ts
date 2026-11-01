import { and, lt, sql } from "drizzle-orm";
import { createDb, type Db } from "./db";
import { chatEvent } from "./db/schema";
import { parseEnv, type Env } from "./lib/env";

/** Live events only matter for resuming a dropped stream; history is in chat_message. */
const EVENT_RETENTION_DAYS = 7;

/**
 * Deletes events older than `olderThan`, always keeping each thread's newest
 * one. The relay restores its sequence counter from MAX(seq): removing a
 * thread's last row would restart numbering at 1, and a client holding an older
 * cursor would then drop the new events as duplicates.
 */
export async function pruneEvents(db: Db, olderThan: Date): Promise<number> {
  const deleted = await db
    .delete(chatEvent)
    .where(
      and(
        lt(chatEvent.createdAt, olderThan),
        sql`"chat_event"."seq" < (select max(e.seq) from chat_event e where e.thread_id = "chat_event"."thread_id")`,
      ),
    )
    .returning({ id: chatEvent.id });
  return deleted.length;
}

/** Cron Trigger (see `triggers.crons` in wrangler.jsonc). */
export const scheduled: ExportedHandlerScheduledHandler<Env> = async (_controller, env, ctx) => {
  const cutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 86_400_000);
  ctx.waitUntil(
    pruneEvents(createDb(parseEnv(env).DATABASE_URL), cutoff).then((count) =>
      console.log(`[retention] pruned ${count} chat events older than ${EVENT_RETENTION_DAYS}d`),
    ),
  );
};
