import { and, eq } from "drizzle-orm";
import type { Db } from "../../db";
import type { Env } from "../../config/env";
import { chatThread } from "../../db/schema";
import type { ChatMode } from "./modes";
import { publishEvent } from "./run/relay";

/** Sets a thread's mode (owner only) and tells the thread's other open tabs. Null when the thread is not the user's. */
export async function setThreadMode(db: Db, env: Env, userId: string, threadId: string, mode: ChatMode) {
  const [updated] = await db
    .update(chatThread)
    .set({ mode })
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, userId)))
    .returning();
  if (updated) await publishEvent(env, threadId, "thread.mode", { mode }).catch(() => undefined);
  return updated ?? null;
}
