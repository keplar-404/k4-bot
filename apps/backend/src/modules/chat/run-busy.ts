import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { chatMessage } from "../../db/schema";
import { ACTIVE_RUN_STATES } from "./cleanup";

/**
 * Whether the thread's latest run is still going. One run at a time per thread: two would share one checkpoint and
 * interleave their messages. `except` is a run id that does not count (a resend of the message that started it).
 */
export async function threadBusy(env: Env, db: Db, threadId: string, except: string | null = null) {
  const [last] = await db
    .select({ runId: chatMessage.runId })
    .from(chatMessage)
    .where(and(eq(chatMessage.threadId, threadId), isNotNull(chatMessage.runId)))
    .orderBy(desc(chatMessage.seq))
    .limit(1);
  if (!last?.runId || last.runId === except) return false;
  const status = await env.CHAT_RUN.get(last.runId)
    .then((i) => i.status())
    .catch(() => null);
  return Boolean(status && ACTIVE_RUN_STATES.has(status.status));
}
