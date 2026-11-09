import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../../db";
import { workflow, workflowRun, workflowRunStep } from "../../../db/schema";

/** Every "Ask me first" block waiting for this user's answer, newest first (the Approvals page). */
export async function waitingApprovals(db: Db, userId: string) {
  const rows = await db
    .select({
      runId: workflowRun.id,
      nodeId: workflowRunStep.nodeId,
      output: workflowRunStep.output,
      since: workflowRunStep.startedAt,
      workflowId: workflow.id,
      workflowName: workflow.name,
      trigger: workflowRun.trigger,
      botId: workflowRun.startedByBotId,
    })
    .from(workflowRunStep)
    .innerJoin(workflowRun, eq(workflowRun.id, workflowRunStep.runId))
    .innerJoin(workflow, eq(workflow.id, workflowRun.workflowId))
    .where(
      and(
        eq(workflowRun.userId, userId),
        eq(workflowRun.status, "running"),
        eq(workflowRunStep.nodeKind, "logic.approval"),
        eq(workflowRunStep.status, "waiting"),
      ),
    )
    .orderBy(desc(workflowRunStep.startedAt))
    .limit(100);
  return rows.map(({ output, ...r }) => ({ ...r, question: (output as { message?: string } | null)?.message ?? "" }));
}
