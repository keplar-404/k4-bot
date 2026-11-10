import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../../../db";
import { workflowRun, workflowRunStep } from "../../../db/schema";
import type { WorkflowGraph } from "../graph/schema";

export type WorkflowStats = {
  workflowId: string;
  runs: number;
  /** Runs (and outcomes) in the chosen period (see RANGES). */
  runsInRange: number;
  succeededInRange: number;
  failedInRange: number;
  lastStatus: string | null;
};

/** The overview's periods: one bar per day (14), week (12), month (12) or year (5), all UTC. */
export const RANGES = {
  day: { unit: "day", count: 14 },
  week: { unit: "week", count: 12 },
  month: { unit: "month", count: 12 },
  year: { unit: "year", count: 5 },
} as const;
export type RunRange = keyof typeof RANGES;

/** SQL for the first instant of the period: the start of the oldest bar. `unit` is from RANGES only. */
const periodStart = (range: RunRange) => {
  const { unit, count } = RANGES[range];
  return sql.raw(`date_trunc('${unit}', now() at time zone 'utc') - interval '${count - 1} ${unit}'`);
};

export type RunTrigger = "manual" | "test" | "schedule" | "webhook" | "bot" | "app";

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

/** Run counts per workflow of this user (all time, in the chosen period, outcomes) in one query, for the cards. */
export async function statsByWorkflow(db: Db, userId: string, range: RunRange = "week"): Promise<WorkflowStats[]> {
  const from = periodStart(range);
  const result = await db.execute(sql`
    SELECT workflow_id AS "workflowId",
      count(*)::int AS runs,
      count(*) FILTER (WHERE created_at >= ${from})::int AS "runsInRange",
      count(*) FILTER (WHERE status = 'succeeded' AND created_at >= ${from})::int AS "succeededInRange",
      count(*) FILTER (WHERE status = 'failed' AND created_at >= ${from})::int AS "failedInRange",
      (array_agg(status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM workflow_run WHERE user_id = ${userId} GROUP BY workflow_id`);
  return result.rows as WorkflowStats[];
}

/** Runs per day, week, month or year (all of this user's workflows), oldest first, for the overview chart. */
export async function runsOverTime(db: Db, userId: string, range: RunRange = "day") {
  const unit = sql.raw(`'${RANGES[range].unit}'`);
  const step = sql.raw(`interval '1 ${RANGES[range].unit}'`);
  const result = await db.execute(sql`
    SELECT to_char(b, 'YYYY-MM-DD') AS start,
      count(r.id) FILTER (WHERE r.status = 'succeeded')::int AS succeeded,
      count(r.id) FILTER (WHERE r.status = 'failed')::int AS failed,
      count(r.id)::int AS total
    FROM generate_series(${periodStart(range)}, date_trunc(${unit}, now() at time zone 'utc'), ${step}) b
    LEFT JOIN workflow_run r ON r.user_id = ${userId} AND date_trunc(${unit}, r.created_at) = b
    GROUP BY b ORDER BY b`);
  return result.rows as Array<{ start: string; succeeded: number; failed: number; total: number }>;
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
