import { and, count, desc, eq } from "drizzle-orm";
import type { Db } from "../../db";
import { type BotTask, botTask, bot } from "../../db/schema";
import { type ScheduleConfig, scheduleConfig } from "../schedules/config";
import { scheduleIssue } from "../schedules/issues";
import { nextOccurrence } from "../schedules/next";

/** Each run is a full, paid bot turn: at most 20 tasks per user, none more often than once an hour. */
export const MAX_TASKS = 20;
export const MIN_TASK_MINUTES = 60;

export type TaskInput = { title: string; prompt: string; schedule: unknown };

const owned = (userId: string, id: string) => and(eq(botTask.id, id), eq(botTask.userId, userId));

export const listTasks = (db: Db, userId: string, botId?: string) =>
  db
    .select()
    .from(botTask)
    .where(and(eq(botTask.userId, userId), botId ? eq(botTask.botId, botId) : undefined))
    .orderBy(desc(botTask.createdAt));

export async function getTask(db: Db, userId: string, id: string): Promise<BotTask | null> {
  const [row] = await db.select().from(botTask).where(owned(userId, id)).limit(1);
  return row ?? null;
}

/** Parses and checks a schedule: the config, or a message saying what is wrong. */
export function checkSchedule(raw: unknown): { schedule: ScheduleConfig } | { error: string } {
  const parsed = scheduleConfig.safeParse(raw);
  if (!parsed.success) return { error: "The schedule is not valid." };
  const issue = scheduleIssue(parsed.data, MIN_TASK_MINUTES);
  return issue ? { error: issue } : { schedule: parsed.data };
}

export async function createTask(db: Db, userId: string, botId: string, input: TaskInput, byBot = false) {
  const checked = checkSchedule(input.schedule);
  if ("error" in checked) return checked;
  const [owner] = await db.select({ id: bot.id }).from(bot).where(and(eq(bot.id, botId), eq(bot.userId, userId)));
  if (!owner) return { error: "Bot not found." };
  const [n] = await db.select({ n: count() }).from(botTask).where(eq(botTask.userId, userId));
  if ((n?.n ?? 0) >= MAX_TASKS) return { error: `You can have up to ${MAX_TASKS} scheduled tasks. Delete one first.` };

  const [row] = await db
    .insert(botTask)
    .values({
      id: crypto.randomUUID(),
      userId,
      botId,
      title: input.title,
      prompt: input.prompt,
      schedule: checked.schedule,
      nextRunAt: nextOccurrence(checked.schedule),
      createdByBot: byBot,
    })
    .returning();
  return { task: row! };
}

/** Edits a task. Turning it on (or changing its schedule) counts the next run from now. */
export async function updateTask(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<TaskInput> & { status?: "active" | "paused" },
) {
  const task = await getTask(db, userId, id);
  if (!task) return { error: "Task not found." };
  // A "once" task that has run can still be paused or renamed: its schedule is only checked when it would run again.
  const recheck = patch.schedule !== undefined || patch.status === "active";
  const checked = recheck ? checkSchedule(patch.schedule ?? task.schedule) : { schedule: task.schedule };
  if ("error" in checked) return checked;
  const status = patch.status ?? task.status;
  const [row] = await db
    .update(botTask)
    .set({
      title: patch.title ?? task.title,
      prompt: patch.prompt ?? task.prompt,
      schedule: checked.schedule,
      status,
      nextRunAt: status === "active" ? nextOccurrence(checked.schedule) : null,
      lastError: null,
    })
    .where(owned(userId, id))
    .returning();
  return { task: row! };
}

export async function deleteTask(db: Db, userId: string, id: string) {
  const rows = await db.delete(botTask).where(owned(userId, id)).returning({ id: botTask.id });
  return rows.length > 0;
}
