import { and, eq } from "drizzle-orm";
import type { Db } from "../../../db";
import { assistantRun, workflow } from "../../../db/schema";

const ACTIVE = ["queued", "running", "waiting"] as const;

/** Whether a lock still holds: only while its run has not ended. A missing or finished run means a stale lock. */
export const lockHolds = (runStatus: string | null | undefined) => (ACTIVE as readonly string[]).includes(runStatus ?? "");

/**
 * The assistant run holding this workflow, or null. A lock whose run already ended (a crash, a missed cleanup) is
 * stale: it is cleared here, so the canvas can never stay read-only forever.
 */
export async function lockHolder(db: Db, userId: string, workflowId: string): Promise<string | null> {
  const [row] = await db
    .select({ runId: workflow.assistantRunId })
    .from(workflow)
    .where(and(eq(workflow.id, workflowId), eq(workflow.userId, userId)))
    .limit(1);
  const runId = row?.runId;
  if (!runId) return null;
  const [run] = await db.select({ status: assistantRun.status }).from(assistantRun).where(eq(assistantRun.id, runId)).limit(1);
  if (lockHolds(run?.status)) return runId;
  await setLock(db, userId, workflowId, null, runId);
  return null;
}

/** Sets or clears the lock. Clearing with `onlyIf` leaves a newer run's lock alone. */
export async function setLock(db: Db, userId: string, workflowId: string, runId: string | null, onlyIf?: string) {
  await db
    .update(workflow)
    .set({ assistantRunId: runId })
    .where(and(eq(workflow.id, workflowId), eq(workflow.userId, userId), ...(onlyIf ? [eq(workflow.assistantRunId, onlyIf)] : [])));
}

export const LOCKED = {
  error: "LOCKED",
  message: "The assistant is working on this workflow. Stop it to edit.",
} as const;

/** The 423 body for a user change while the assistant holds the workflow, or null when it may go ahead. */
export async function lockedResponse(db: Db, userId: string, workflowId: string) {
  return (await lockHolder(db, userId, workflowId)) ? LOCKED : null;
}
