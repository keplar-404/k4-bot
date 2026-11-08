import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import { workflowRun } from "../../../db/schema";

const UNFINISHED = ["queued", "running"] as const;

/** Runs that have not finished: the ones to stop when their workflow is deleted. */
export async function activeRunIds(db: Db, userId: string, workflowId: string) {
  const rows = await db
    .select({ id: workflowRun.id })
    .from(workflowRun)
    .where(
      and(
        eq(workflowRun.userId, userId),
        eq(workflowRun.workflowId, workflowId),
        inArray(workflowRun.status, UNFINISHED),
      ),
    );
  return rows.map((row) => row.id);
}

/** Cancels a run that is still going. Null when it is not this user's, or it already finished. */
export async function cancelRunRow(db: Db, userId: string, runId: string) {
  const [row] = await db
    .update(workflowRun)
    .set({ status: "cancelled", finishedAt: sql`now()` })
    .where(and(eq(workflowRun.id, runId), eq(workflowRun.userId, userId), inArray(workflowRun.status, UNFINISHED)))
    .returning({ id: workflowRun.id, workflowId: workflowRun.workflowId });
  return row ?? null;
}

/** Stops the Workflow instances of these runs. One that already ended is fine: the row is what counts. */
export async function stopRuns(env: Env, runIds: string[]) {
  await Promise.allSettled(runIds.map(async (runId) => (await env.WORKFLOW_RUN.get(runId)).terminate()));
}
