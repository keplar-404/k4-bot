import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "../../db";
import type { Part } from "../agent/parts";
import { type AssistantTodo, assistantMemory, assistantMessage, assistantRun, assistantThread, workflow } from "../../db/schema";

export const ACTIVE_RUN = ["queued", "running", "waiting"] as const;
export const MAX_THREADS = 200;
export const MAX_MEMORY_CHARS = 8000;
/** How much history the model is given each turn. */
const HISTORY_MESSAGES = 40;

/** Every read goes through the owner: a thread id alone never reaches another user's chat. */
const ownThread = (userId: string, id: string) => and(eq(assistantThread.id, id), eq(assistantThread.userId, userId));

export async function listThreads(db: Db, userId: string, before?: string) {
  return db
    .select({
      id: assistantThread.id,
      title: assistantThread.title,
      workflowId: assistantThread.workflowId,
      workflowName: workflow.name,
      updatedAt: assistantThread.updatedAt,
    })
    .from(assistantThread)
    .leftJoin(workflow, eq(workflow.id, assistantThread.workflowId))
    .where(and(eq(assistantThread.userId, userId), before ? lt(assistantThread.updatedAt, new Date(before)) : undefined))
    .orderBy(desc(assistantThread.updatedAt))
    .limit(30);
}

export async function getThread(db: Db, userId: string, id: string) {
  const [row] = await db.select().from(assistantThread).where(ownThread(userId, id)).limit(1);
  return row ?? null;
}

export async function createThread(db: Db, userId: string, workflowId: string | null) {
  const [row] = await db
    .insert(assistantThread)
    .values({ id: crypto.randomUUID(), userId, workflowId })
    .returning();
  // Keep the newest MAX_THREADS: older chats are dropped so one user cannot grow the table without end.
  await db.execute(sql`
    DELETE FROM assistant_thread WHERE user_id = ${userId} AND id IN (
      SELECT id FROM assistant_thread WHERE user_id = ${userId} ORDER BY updated_at DESC OFFSET ${MAX_THREADS})`);
  return row!;
}

export async function updateThread(db: Db, userId: string, id: string, patch: { title?: string; workflowId?: string; modelId?: string }) {
  const [row] = await db
    .update(assistantThread)
    .set({ ...patch, updatedAt: new Date() })
    .where(ownThread(userId, id))
    .returning();
  return row ?? null;
}

export async function deleteThread(db: Db, userId: string, id: string) {
  const rows = await db.delete(assistantThread).where(ownThread(userId, id)).returning({ id: assistantThread.id });
  return rows.length > 0;
}

export async function threadMessages(db: Db, userId: string, threadId: string) {
  return db
    .select()
    .from(assistantMessage)
    .where(and(eq(assistantMessage.threadId, threadId), eq(assistantMessage.userId, userId)))
    .orderBy(asc(assistantMessage.createdAt));
}

/** The last messages, oldest first, for the model. */
export async function recentMessages(db: Db, threadId: string) {
  const rows = await db
    .select({ role: assistantMessage.role, content: assistantMessage.content })
    .from(assistantMessage)
    .where(eq(assistantMessage.threadId, threadId))
    .orderBy(desc(assistantMessage.createdAt))
    .limit(HISTORY_MESSAGES);
  return rows.reverse();
}

export async function addMessage(
  db: Db,
  m: { threadId: string; userId: string; role: "user" | "assistant"; content: string; files?: Array<{ id: string; name: string; mimeType: string }>; todos?: AssistantTodo[]; parts?: Part[]; runId?: string },
) {
  await db.insert(assistantMessage).values({ id: crypto.randomUUID(), files: [], todos: [], parts: [], ...m });
  await db.update(assistantThread).set({ updatedAt: new Date() }).where(eq(assistantThread.id, m.threadId));
}

export async function activeRunOf(db: Db, userId: string) {
  const [row] = await db
    .select()
    .from(assistantRun)
    .where(and(eq(assistantRun.userId, userId), inArray(assistantRun.status, [...ACTIVE_RUN])))
    .orderBy(desc(assistantRun.createdAt))
    .limit(1);
  return row ?? null;
}

export async function latestRunOf(db: Db, userId: string, threadId: string) {
  const [row] = await db
    .select()
    .from(assistantRun)
    .where(and(eq(assistantRun.threadId, threadId), eq(assistantRun.userId, userId)))
    .orderBy(desc(assistantRun.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getRunRow(db: Db, runId: string) {
  const [row] = await db.select().from(assistantRun).where(eq(assistantRun.id, runId)).limit(1);
  return row ?? null;
}

export async function setRun(db: Db, runId: string, patch: Partial<typeof assistantRun.$inferInsert>) {
  await db.update(assistantRun).set(patch).where(eq(assistantRun.id, runId));
}

export async function loadMemory(db: Db, userId: string) {
  const [row] = await db.select({ content: assistantMemory.content }).from(assistantMemory).where(eq(assistantMemory.userId, userId));
  return row?.content ?? "";
}

export async function saveMemory(db: Db, userId: string, content: string) {
  const text = content.slice(0, MAX_MEMORY_CHARS);
  await db
    .insert(assistantMemory)
    .values({ userId, content: text })
    .onConflictDoUpdate({ target: assistantMemory.userId, set: { content: text, updatedAt: new Date() } });
}
