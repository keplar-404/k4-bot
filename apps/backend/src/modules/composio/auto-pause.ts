import { and, count, eq, gte } from "drizzle-orm";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { workflow, workflowRun } from "../../db/schema";
import type { WorkflowGraph } from "../workflows/graph/schema";
import { pauseWorkflow } from "../workflows/store/publish";
import type { WorkflowRow } from "../workflows/store/workflows";

/** Runs from app events in this window, by a workflow that also acts on the app it listens to, look like a loop. */
export const SELF_LOOP = { runs: 30, windowMs: 5 * 60_000 } as const;

const usesAccount = (node: WorkflowGraph["nodes"][number], toolkit: string, accountId: string) =>
  (node.kind === "trigger.app" || node.kind === "action.app") &&
  node.config.toolkit === toolkit &&
  (!node.config.connectedAccountId || node.config.connectedAccountId === accountId);

/**
 * An app connection expired (composio.connected_account.expired): every workflow of that user that is on and uses
 * the app is turned off and says why. Without this an app-event workflow would silently stop getting events.
 */
export async function pauseForExpiredAccount(
  env: Env,
  db: Db,
  account: { userId: string; toolkit: string; accountId: string },
) {
  const active = await db
    .select()
    .from(workflow)
    .where(and(eq(workflow.userId, account.userId), eq(workflow.status, "active")));
  const affected = active.filter((w) =>
    (w.publishedGraph?.nodes ?? []).some((n) => usesAccount(n, account.toolkit, account.accountId)),
  );
  const reason = `Your ${account.toolkit} connection expired. Reconnect it on the Connect page, then turn this workflow on again.`;
  for (const w of affected) await pauseWorkflow(env, db, account.userId, w, reason);
  return affected.length;
}

/**
 * Whether an app-event workflow seems to start itself: it acts on the app whose events start it (a bot replying in
 * the Slack channel it watches) and has run very often in the last few minutes. Such a workflow is turned off.
 */
export async function stopIfSelfTriggering(env: Env, db: Db, w: WorkflowRow, toolkit: string) {
  const acts = (w.publishedGraph?.nodes ?? []).some((n) => n.kind === "action.app" && n.config.toolkit === toolkit);
  if (!acts) return false;
  const [recent] = await db
    .select({ n: count() })
    .from(workflowRun)
    .where(
      and(
        eq(workflowRun.workflowId, w.id),
        eq(workflowRun.trigger, "app"),
        gte(workflowRun.createdAt, new Date(Date.now() - SELF_LOOP.windowMs)),
      ),
    );
  if ((recent?.n ?? 0) < SELF_LOOP.runs) return false;
  const reason = `Turned off: it ran ${SELF_LOOP.runs} times in 5 minutes and also acts on ${toolkit}, so it is probably starting itself. Add a condition (for Slack: ignore bot messages), then turn it on again.`;
  await pauseWorkflow(env, db, w.userId, w, reason);
  return true;
}
