import { and, eq, gte, inArray, isNotNull, like } from "drizzle-orm";
import { NeonHttpCheckpointer } from "../agent/checkpointer/neon-http-checkpointer";
import type { Db } from "../../db";
import { chatMessage, chatThread, checkpoint, checkpointBlobs, checkpointWrites } from "../../db/schema";
import { publishEvent } from "./run/relay";
import type { Env } from "../../config/env";

/** A run can wait on the user for up to 7 days per step; anything older has finished or will stop by itself. */
const ACTIVE_RUN_WINDOW_MS = 8 * 24 * 60 * 60_000;

/**
 * Everything about these threads that the database cascade does not remove, to be called BEFORE their
 * rows are deleted (it needs them to find the runs):
 *  - runs still going are terminated, so they stop calling the model and the computer at once
 *    (a run that slips through also stops at its next slice, which checks its thread still exists);
 *  - agent checkpoints are deleted (they are keyed by thread id, without a foreign key);
 *  - each thread's relay object closes its live sockets and drops its storage.
 * Messages, events and the thread rows themselves go with the database cascade; usage rows stay,
 * unlinked, because the daily budgets count them.
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
  // Group chats keep one agent state per member, under "<thread>:<bot>".
  await Promise.all(threadIds.map((id) => deleteMemberCheckpoints(db, id)));
  await Promise.allSettled(threadIds.map((id) => env.CHAT_RELAY.get(env.CHAT_RELAY.idFromName(id)).purge()));
  // Their background tasks' records (running task workflows end on their own within 15 minutes).
  await Promise.allSettled(threadIds.map((id) => env.ASYNC_TASKS.get(env.ASYNC_TASKS.idFromName(id)).purge()));
}

/** Workflow states in which a run can still produce output. */
export const ACTIVE_RUN_STATES = new Set(["queued", "running", "waiting", "waitingForPause"]);

/**
 * Stops the runs these bots of this user still have going (the computer was reset under them). A terminated
 * workflow reports nothing itself, so each chat is told here, or it would show "Thinking…" forever.
 */
export async function stopBotRuns(db: Db, env: Env, userId: string, botIds: string[], reason: string): Promise<void> {
  if (botIds.length === 0) return;
  const runs = await db
    .selectDistinct({ runId: chatMessage.runId, threadId: chatMessage.threadId })
    .from(chatMessage)
    .innerJoin(chatThread, eq(chatThread.id, chatMessage.threadId))
    .where(
      and(
        eq(chatThread.userId, userId),
        inArray(chatThread.botId, botIds),
        isNotNull(chatMessage.runId),
        gte(chatMessage.createdAt, new Date(Date.now() - ACTIVE_RUN_WINDOW_MS)),
      ),
    );
  await Promise.allSettled(
    runs.map(async ({ runId, threadId }) => {
      const instance = await env.CHAT_RUN.get(runId!);
      if (!ACTIVE_RUN_STATES.has((await instance.status()).status)) return;
      await instance.terminate();
      await publishEvent(env, threadId, "run.failed", { runId, error: reason, notice: true });
    }),
  );
}

async function deleteMemberCheckpoints(db: Db, threadId: string) {
  const prefix = `${threadId}:%`;
  await db.batch([
    db.delete(checkpointWrites).where(like(checkpointWrites.threadId, prefix)),
    db.delete(checkpointBlobs).where(like(checkpointBlobs.threadId, prefix)),
    db.delete(checkpoint).where(like(checkpoint.threadId, prefix)),
  ]);
}
