import { and, lt, sql } from "drizzle-orm";
import { createDb, type Db } from "./db";
import { chatEvent } from "./db/schema";
import { parseEnv, type Env } from "./config/env";
import { refreshCatalog } from "./modules/composio/catalog-refresh";
import { sandboxFor } from "./modules/sandbox/sandbox-backend";
import { staleRunning } from "./modules/sandbox/store";
import { runDueSchedules, sweepStuckRuns } from "./modules/workflows/engine/schedule";

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
export const scheduled: ExportedHandlerScheduledHandler<Env> = async (controller, env, ctx) => {
  const cfg = parseEnv(env);
  const db = createDb(cfg.DATABASE_URL);
  if (controller.cron === "* * * * *") {
    // Per-minute: fire due scheduled workflows.
    ctx.waitUntil(runDueSchedules(cfg, db).catch((e) => console.error("[schedule] failed", e)));
    return;
  }
  // Daily (0 3 * * *): retention, catalog refresh, stale sandboxes, stuck-run sweep.
  const cutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 86_400_000);
  ctx.waitUntil(pauseStaleSandboxes(env));
  ctx.waitUntil(refreshCatalog(db, cfg));
  ctx.waitUntil(
    pruneEvents(db, cutoff).then((count) =>
      console.log(`[retention] pruned ${count} chat events older than ${EVENT_RETENTION_DAYS}d`),
    ),
  );
  ctx.waitUntil(sweepStuckRuns(db).catch((e) => console.error("[sweep] failed", e)));
};

/** Safety net: a sandbox still marked running with no use for twice the idle window (its alarm was lost) is paused. */
async function pauseStaleSandboxes(env: Env) {
  const cfg = parseEnv(env);
  const rows = await staleRunning(createDb(cfg.DATABASE_URL), 2 * cfg.SANDBOX_IDLE_MINUTES * 60_000);
  await Promise.allSettled(rows.map((r) => sandboxFor(env, r.botId).pauseIfStale(r.userId)));
  if (rows.length) console.log(`[sandbox] paused ${rows.length} stale sandbox(es)`);
}
