import { desc, eq } from "drizzle-orm";
import type { Db } from "../../../db";
import { webhookRequest } from "../../../db/schema";
import { hashToken } from "../graph/triggers";

/** Records one call to a webhook. Bookkeeping: it never fails the request. */
export async function logHook(
  db: Db,
  entry: { workflowId: string; status: number; reason: string; ip: string; runId?: string },
) {
  await db
    .insert(webhookRequest)
    .values({
      workflowId: entry.workflowId,
      status: entry.status,
      reason: entry.reason,
      // Enough to tell callers apart, without keeping their addresses.
      ipHash: (await hashToken(entry.ip)).slice(0, 12),
      runId: entry.runId ?? null,
    })
    .catch((error) => console.error("[hooks] request not logged", error));
}

/** The last 50 calls to a workflow's webhook (the builder's Requests list). The caller checks ownership. */
export function recentHooks(db: Db, workflowId: string) {
  return db
    .select({ at: webhookRequest.at, status: webhookRequest.status, reason: webhookRequest.reason, ipHash: webhookRequest.ipHash, runId: webhookRequest.runId })
    .from(webhookRequest)
    .where(eq(webhookRequest.workflowId, workflowId))
    .orderBy(desc(webhookRequest.at))
    .limit(50);
}
