import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../../../db";
import { bot, chatFile, chatMessage, chatThread } from "../../../db/schema";
import type { AgentBot } from "../../agent/agent";
import type { FileRef } from "../../agent/parts";
import { toRef } from "../../files";
import { nextMessageSeq } from "../threads";
import type { ChatRunParams } from "./types";

/** The thread's bot as the agent needs it. Throws when the thread is not the user's. */
export async function loadBot(db: Db, params: ChatRunParams): Promise<AgentBot> {
  const [row] = await db
    .select({
      id: bot.id,
      name: bot.name,
      description: bot.description,
      role: bot.role,
      roleTitle: bot.roleTitle,
      subagentsEnabled: bot.subagentsEnabled,
      maxSubagents: bot.maxSubagents,
      maxParallelTools: bot.maxParallelTools,
    })
    .from(chatThread)
    .innerJoin(bot, eq(bot.id, chatThread.botId))
    .where(and(eq(chatThread.id, params.threadId), eq(chatThread.userId, params.userId)))
    .limit(1);
  if (!row) throw new Error(`Thread ${params.threadId} not found for user`);
  return row;
}

/** Stores the user's message with its attached files and returns those files. */
export async function saveUserMessage(db: Db, params: ChatRunParams, botId: string): Promise<FileRef[]> {
  // The user's own files only; they now belong to this chat (and stay in the Files page if it is deleted).
  const files: FileRef[] = params.fileIds?.length
    ? (await db.select().from(chatFile).where(and(eq(chatFile.userId, params.userId), inArray(chatFile.id, params.fileIds)))).map(toRef)
    : [];
  if (files.length) {
    await db
      .update(chatFile)
      .set({ threadId: params.threadId, botId })
      .where(and(eq(chatFile.userId, params.userId), inArray(chatFile.id, files.map((f) => f.id)), isNull(chatFile.threadId)));
  }
  await db
    .insert(chatMessage)
    .values({
      id: params.userMessageId,
      threadId: params.threadId,
      role: "user",
      parts: [{ type: "text", text: params.content }, ...files.map((file) => ({ type: "file" as const, file }))],
      runId: params.runId,
      seq: nextMessageSeq(params.threadId),
    })
    // A retried send reuses the id, so the message is stored once.
    .onConflictDoNothing();
  return files;
}
