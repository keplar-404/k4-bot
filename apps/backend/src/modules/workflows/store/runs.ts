import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../../../db";
import { workflowRun, workflowRunStep } from "../../../db/schema";
import type { WorkflowGraph } from "../graph/schema";

export type WorkflowStats = {
  workflowId: string;
  runs: number;
  runs7d: number;
  succeeded7d: number;
  failed7d: number;
  lastStatus: string | null;
};

export type RunTrigger = "manual" | "test" | "schedule" | "webhook" | "bot";

type NewRun = { workflowId: string; userId: string; version: number; trigger: RunTrigger; graph: WorkflowGraph };

export async function createRun(db: Db, args: NewRun & { input?: unknown; botId?: string }) {
  const [row] = await db
    .insert(workflowRun)
    .values({
      id: crypto.randomUUID(),
      workflowId: args.workflowId,
      userId: args.userId,
      version: args.version,
      trigger: args.trigger,
      status: "queued",
      graph: args.graph,
      input: args.input ?? null,
      startedByBotId: args.botId ?? null,
    })
    .returning();
  return row!;
}

/** Run counts per workflow of this user (all time, last 7 days, outcomes) in one query, for the overview cards. */
export async function statsByWorkflow(db: Db, userId: string): Promise<WorkflowStats[]> {
  const result = await db.execute(sql`
    SELECT workflow_id AS "workflowId",
      count(*)::int AS runs,
      count(*) FILTER (WHERE created_at > now() at time zone 'utc' - interval '7 days')::int AS "runs7d",
      count(*) FILTER (WHERE status = 'succeeded' AND created_at > now() at time zone 'utc' - interval '7 days')::int AS "succeeded7d",
      count(*) FILTER (WHERE status = 'failed' AND created_at > now() at time zone 'utc' - interval '7 days')::int AS "failed7d",
      (array_agg(status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM workflow_run WHERE user_id = ${userId} GROUP BY workflow_id`);
  return result.rows as WorkflowStats[];
}

/** Runs per day for the last 14 days (all of this user's workflows), for the overview chart. */
export async function dailyRuns(db: Db, userId: string) {
  const result = await db.execute(sql`
    SELECT to_char(d, 'YYYY-MM-DD') AS day,
      count(r.id) FILTER (WHERE r.status = 'succeeded')::int AS succeeded,
      count(r.id) FILTER (WHERE r.status = 'failed')::int AS failed,
      count(r.id)::int AS total
    FROM generate_series((now() at time zone 'utc')::date - 13, (now() at time zone 'utc')::date, interval '1 day') d
    LEFT JOIN workflow_run r ON r.user_id = ${userId} AND r.created_at::date = d::date
    GROUP BY d ORDER BY d`);
  return result.rows as Array<{ day: string; succeeded: number; failed: number; total: number }>;
}

/** A workflow's latest runs (the runs drawer). Graph and input stay out: the list only needs the outcome. */
export async function listRuns(db: Db, userId: string, workflowId: string, limit = 30) {
  return db
    .select({
      id: workflowRun.id,
      trigger: workflowRun.trigger,
      status: workflowRun.status,
      version: workflowRun.version,
      error: workflowRun.error,
      failedNodeId: workflowRun.failedNodeId,
      createdAt: workflowRun.createdAt,
      startedAt: workflowRun.startedAt,
      finishedAt: workflowRun.finishedAt,
    })
    .from(workflowRun)
    .where(and(eq(workflowRun.userId, userId), eq(workflowRun.workflowId, workflowId)))
    .orderBy(desc(workflowRun.createdAt))
    .limit(limit);
}

/** One run with its steps in the order they ran, or null when it is not this user's. */
export async function getRun(db: Db, userId: string, runId: string) {
  const [run] = await db
    .select()
    .from(workflowRun)
    .where(and(eq(workflowRun.id, runId), eq(workflowRun.userId, userId)))
    .limit(1);
  if (!run) return null;
  const steps = await db
    .select()
    .from(workflowRunStep)
    .where(eq(workflowRunStep.runId, runId))
    .orderBy(asc(workflowRunStep.startedAt));
  return { ...run, steps };
}
