import { and, gte, inArray, isNotNull } from "drizzle-orm";
import { NeonHttpCheckpointer } from "../agent/checkpointer/neon-http-checkpointer";
import type { Db } from "../db";
import { chatMessage } from "../db/schema";
import type { Env } from "./env";

/** A run can wait on the user for up to 7 days per step; anything older has finished or will stop by itself. */
const ACTIVE_RUN_WINDOW_MS = 8 * 24 * 60 * 60_000;

/**
 * Everything about these threads that the database cascade does not remove, to be called BEFORE their
 * rows are deleted (it needs them to find the runs):
 *  - runs still going are terminated, so they stop calling the model and the computer at once
 *    (a run that slips through also stops at its next slice, which checks its thread still exists);
 *  - agent checkpoints are deleted (they are keyed by thread id, without a foreign key).
 */
export async function cleanupThreads(db: Db, env: Env, threadIds: string[]): Promise<void> {
  if (threadIds.length === 0) return;
  const runs = await db
    .selectDistinct({ runId: chatMessage.runId })
    .from(chatMessage)
    .where(
      and(
        inArray(chatMessage.threadId, threadIds),
        isNotNull(chatMessage.runId),
        gte(chatMessage.createdAt, new Date(Date.now() - ACTIVE_RUN_WINDOW_MS)),
      ),
    );
  // Finished instances refuse to terminate; that is expected and ignored.
  await Promise.allSettled(
    runs.map(async ({ runId }) => (await env.CHAT_RUN.get(runId!)).terminate()),
  );
  const checkpointer = new NeonHttpCheckpointer(db);
  await Promise.all(threadIds.map((id) => checkpointer.deleteThread(id)));
}
