import { and, desc, eq, sql } from "drizzle-orm";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { type BotTask, botTask, chatThread } from "../../db/schema";
import { taskMessage } from "../../prompts/tasks";
import type { ChatRunParams } from "../chat/run/types";
import { threadBusy } from "../chat/run-busy";
import { quotaExceeded } from "../chat/threads";

/**
 * One run of a task: the prompt goes to the bot as a new message in its chat (the conversation the chat page opens),
 * exactly like the user typing it. So the answer streams live into the chat, the bot has its tools and the
 * conversation so far, and in Ask mode its actions wait for the user's approval there. Returns why it did not start.
 */
export async function startTask(env: Env, db: Db, task: BotTask): Promise<string | null> {
  const quota = await quotaExceeded(db, env, task.userId);
  if (quota) return quota;

  const [latest] = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.botId, task.botId), eq(chatThread.userId, task.userId)))
    .orderBy(desc(chatThread.updatedAt))
    .limit(1);
  let threadId = latest?.id;
  if (!threadId) {
    threadId = crypto.randomUUID();
    await db.insert(chatThread).values({ id: threadId, botId: task.botId, userId: task.userId, title: task.title });
  }
  if (task.threadId !== threadId) await db.update(botTask).set({ threadId }).where(eq(botTask.id, task.id));
  if (await threadBusy(env, db, threadId)) return "The bot was still answering the previous run of this task.";

  const runId = crypto.randomUUID();
  await env.CHAT_RUN.create({
    id: runId,
    params: {
      runId,
      threadId,
      userId: task.userId,
      userMessageId: runId,
      content: taskMessage(task.title, task.prompt),
    } satisfies ChatRunParams,
  });
  // Brings the thread to the top of the chat list.
  await db.update(chatThread).set({ updatedAt: sql`now()` }).where(eq(chatThread.id, threadId));
  return null;
}
