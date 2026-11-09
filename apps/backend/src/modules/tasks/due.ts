import { and, eq, lte } from "drizzle-orm";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { type BotTask, botTask } from "../../db/schema";
import { nextOccurrence } from "../schedules/next";
import { startTask } from "./start";

const BATCH = 50;

/**
 * The per-minute cron: starts every task that is due. Like workflow schedules, a late run is not made up, and a
 * "once" task turns itself off after it runs.
 */
export async function runDueTasks(env: Env, db: Db) {
  const due = await db
    .select()
    .from(botTask)
    .where(and(eq(botTask.status, "active"), lte(botTask.nextRunAt, new Date())))
    .orderBy(botTask.nextRunAt)
    .limit(BATCH);
  await Promise.allSettled(due.map((task) => startDue(env, db, task)));
}

async function startDue(env: Env, db: Db, task: BotTask) {
  const now = new Date();
  const next = nextOccurrence(task.schedule, now.getTime());
  // Claim first (only while still due), so two overlapping cron runs never start it twice.
  const claimed = await db
    .update(botTask)
    .set({ nextRunAt: next, lastRunAt: now, ...(next ? {} : { status: "paused" as const }) })
    .where(and(eq(botTask.id, task.id), eq(botTask.status, "active"), lte(botTask.nextRunAt, now)))
    .returning({ id: botTask.id });
  if (claimed.length === 0) return;

  let problem: string | null;
  try {
    problem = await startTask(env, db, task);
  } catch (error) {
    console.error("[tasks] could not start", task.id, error);
    problem = "Could not start. It will try again at the next scheduled time.";
  }
  await db.update(botTask).set({ lastError: problem }).where(eq(botTask.id, task.id));
}
