import { handOverGroupThreads } from "../groups/store";
import { and, eq } from "drizzle-orm";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { bot, chatThread } from "../../db/schema";
import { cleanupThreads } from "../chat/cleanup";
import { computerFor } from "../computer/sandbox-backend";
import { sandboxFor } from "../sandbox/sandbox-backend";

/**
 * Deletes the bot and everything it owns: its running work is stopped, its chats go with it (the
 * database cascades threads, messages and events), its agent memory is removed, and its Linux account
 * and files are removed from the user's computer (now if it is awake, otherwise on its next wake).
 */
/** Returns what happened to its account on the computer: removed (checked on the VM), pending (asleep: on next wake) or failed. */
export async function deleteBotEverything(db: Db, env: Env, userId: string, id: string): Promise<"removed" | "pending" | "failed"> {
  // Group chats it was made for live on with another member (only a group with no one else left goes with it).
  await handOverGroupThreads(db, userId, id);
  const threads = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.botId, id), eq(chatThread.userId, userId)));
  // Stop its runs first, so nothing writes to rows that are about to go.
  await cleanupThreads(
    db,
    env,
    threads.map((t) => t.id),
  );
  // Its code sandbox goes in E2B too (the table row would go with the bot, the paid machine would not).
  await sandboxFor(env, id)
    .destroy(userId)
    .catch((e: unknown) => console.error("[bots] sandbox cleanup failed", e));
  await db.delete(bot).where(and(eq(bot.id, id), eq(bot.userId, userId)));
  // Its files on the computer. A failure here must not undo the deletion above: its runs are stopped
  // and its threads are gone (every run slice checks its thread still exists), so nothing uses it again.
  return computerFor(env, userId)
    .removeBot(id)
    .catch((e: unknown) => {
      console.error("[bots] computer cleanup failed", e);
      return "failed" as const;
    });
}
