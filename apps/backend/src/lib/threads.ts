import { and, count, eq, gte, sql } from "drizzle-orm";
import type { Db } from "../db";
import { agentUsage, chatMessage, chatThread } from "../db/schema";
import type { Env } from "./env";

export async function getOwnedThread(db: Db, threadId: string, userId: string) {
  const [thread] = await db
    .select()
    .from(chatThread)
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, userId)))
    .limit(1);
  return thread;
}

/** Messages are ordered by a per-thread counter, not by clock time. */
export async function nextMessageSeq(db: Db, threadId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${chatMessage.seq}), 0)` })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId));
  return Number(row?.max ?? 0) + 1;
}

const startOfUtcDay = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/** Tokens this user has spent today (UTC). The slices of a long run check this before each step. */
export async function tokensUsedToday(db: Db, userId: string): Promise<number> {
  const [spend] = await db
    .select({
      tokens: sql<number>`coalesce(sum(${agentUsage.inputTokens} + ${agentUsage.outputTokens}), 0)`,
    })
    .from(agentUsage)
    .where(and(eq(agentUsage.userId, userId), gte(agentUsage.createdAt, startOfUtcDay())));
  return Number(spend?.tokens ?? 0);
}

/**
 * Daily spend guard, checked before a run is started. Runs are counted from the
 * user's own messages, so a run that crashes still counts.
 * Returns a user-facing reason when the limit is hit.
 */
export async function quotaExceeded(db: Db, env: Env, userId: string): Promise<string | null> {
  const [[runs], tokens] = await Promise.all([
    db
      .select({ used: count() })
      .from(chatMessage)
      .innerJoin(chatThread, eq(chatMessage.threadId, chatThread.id))
      .where(
        and(
          eq(chatThread.userId, userId),
          eq(chatMessage.role, "user"),
          gte(chatMessage.createdAt, startOfUtcDay()),
        ),
      ),
    tokensUsedToday(db, userId),
  ]);

  if (Number(runs?.used ?? 0) >= env.MAX_RUNS_PER_USER) {
    return `Daily limit of ${env.MAX_RUNS_PER_USER} messages reached. Resets at 00:00 UTC.`;
  }
  if (tokens >= env.MAX_DAILY_TOKENS_PER_USER) {
    return `Daily token budget of ${env.MAX_DAILY_TOKENS_PER_USER} reached. Resets at 00:00 UTC.`;
  }
  return null;
}
