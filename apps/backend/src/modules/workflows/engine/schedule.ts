import { and, eq, lt, lte } from "drizzle-orm";
import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import { workflow, workflowRun } from "../../../db/schema";
import { nextRunAt, triggerOf } from "../graph/triggers";
import { userMessage } from "./errors";
import { startRun } from "./start";

const BATCH = 100;
const AT_ONCE = 10;
const DAY_MS = 86_400_000;

type DueWorkflow = typeof workflow.$inferSelect;

/**
 * The per-minute cron: starts every scheduled workflow that is due. A run that is late (the worker was down) is
 * not made up: the next one is counted from now.
 */
export async function runDueSchedules(env: Env, db: Db) {
  const due = await db
    .select()
    .from(workflow)
    .where(
      and(
        eq(workflow.status, "active"),
        eq(workflow.triggerKind, "trigger.schedule"),
        lte(workflow.nextRunAt, new Date()),
      ),
    )
    .orderBy(workflow.nextRunAt)
    .limit(BATCH);

  for (let i = 0; i < due.length; i += AT_ONCE) {
    await Promise.allSettled(due.slice(i, i + AT_ONCE).map((w) => startScheduled(env, db, w)));
  }
}

async function startScheduled(env: Env, db: Db, w: DueWorkflow) {
  const dueAt = w.nextRunAt;
  const graph = w.publishedGraph;
  if (!dueAt || !graph) return;

  // Claim it first: the update only applies while it is still due, and it moves next_run_at into the future, so
  // a second cron run that overlaps this one finds nothing to claim. (Not "equals the value we read": Postgres
  // keeps microseconds and a JS Date only milliseconds, so that comparison can miss.)
  const now = new Date();
  const next = nextRunAt(triggerOf(graph), now.getTime());
  const claimed = await db
    .update(workflow)
    // A "once" schedule has no next time: the workflow turns itself off after this run.
    .set({ nextRunAt: next, lastRunAt: now, ...(next ? {} : { status: "paused" as const }) })
    .where(and(eq(workflow.id, w.id), eq(workflow.status, "active"), lte(workflow.nextRunAt, now)))
    .returning({ id: workflow.id });
  if (claimed.length === 0) return;

  try {
    await startRun(env, db, {
      workflowId: w.id,
      userId: w.userId,
      trigger: "schedule",
      graph,
      input: { scheduledAt: dueAt.toISOString() },
    });
  } catch (error) {
    // Say why in the run history, so "it did not run" has an answer (for example the daily limit).
    console.error("[schedule] could not start", w.id, userMessage(error));
    await db
      .insert(workflowRun)
      .values({
        id: crypto.randomUUID(),
        workflowId: w.id,
        userId: w.userId,
        version: w.publishedVersion,
        trigger: "schedule",
        status: "failed",
        graph,
        error: `Skipped: ${userMessage(error)}`,
        finishedAt: new Date(),
      })
      .catch(() => undefined);
  }
}

/** Daily: a run still "running" after 9 days, or "queued" for 10 minutes, will never finish. Say so. */
export async function sweepStuckRuns(db: Db) {
  const now = Date.now();
  await db
    .update(workflowRun)
    .set({ status: "failed", error: "Timed out", finishedAt: new Date() })
    .where(and(eq(workflowRun.status, "running"), lt(workflowRun.startedAt, new Date(now - 9 * DAY_MS))));
  await db
    .update(workflowRun)
    .set({ status: "failed", error: "Could not start", finishedAt: new Date() })
    .where(and(eq(workflowRun.status, "queued"), lt(workflowRun.createdAt, new Date(now - 10 * 60_000))));
}
