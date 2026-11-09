import { and, eq, ne } from "drizzle-orm";
import type { Env } from "../../../config/env";
import type { Db } from "../../../db";
import { workflow } from "../../../db/schema";
import { startAppTrigger, stopAppTrigger } from "../../composio/triggers";
import { graphSchema, type WorkflowNode } from "../graph/schema";
import { newWebhookToken, nextRunAt, triggerOf } from "../graph/triggers";
import { type GraphIssue, publishIssues } from "../graph/validate";
import { countWorkflows, MAX_ACTIVE, setStatus, type WorkflowRow } from "./workflows";

export type PublishResult =
  | { ok: true; row: WorkflowRow; webhookToken: string | null }
  | {
      ok: false;
      status: 409 | 422 | 502;
      error: "NOT_READY" | "LIMIT" | "UNAVAILABLE";
      message: string;
      issues?: GraphIssue[];
    };

/**
 * Turns a workflow on: re-validates the whole draft, freezes it as the copy that runs, and gets its trigger ready (a
 * webhook token, returned once; or a Composio trigger instance for an app event). One code path for the Turn on
 * button and for a bot's turn_on_workflow.
 */
export async function publishWorkflow(env: Env, db: Db, userId: string, row0: WorkflowRow): Promise<PublishResult> {
  // A draft saved before a setting existed gets that setting's default before it goes live.
  const w = { ...row0, graph: graphSchema.safeParse(row0.graph).data ?? row0.graph };
  const issues = publishIssues(w.graph);
  if (issues.length) return { ok: false, status: 422, error: "NOT_READY", message: issues[0]!.message, issues };
  if (w.status !== "active" && (await countWorkflows(db, userId, "active")) >= MAX_ACTIVE) {
    const message = `Up to ${MAX_ACTIVE} workflows can be on at once. Turn one off first.`;
    return { ok: false, status: 409, error: "LIMIT", message };
  }

  const trigger = triggerOf(w.graph);
  let composioTriggerId: string | null = null;
  if (trigger?.kind === "trigger.app") {
    const started = await listenForAppEvent(env, userId, trigger);
    if ("error" in started) return { ok: false, status: started.status, error: started.code, message: started.error };
    composioTriggerId = started.triggerId;
  }

  const webhook = trigger?.kind === "trigger.webhook" && !w.webhookTokenHash ? await newWebhookToken() : null;
  const row = await setStatus(db, userId, w.id, {
    status: "active",
    publishedGraph: w.graph,
    publishedVersion: w.publishedVersion + 1,
    triggerKind: trigger?.kind ?? null,
    nextRunAt: nextRunAt(trigger),
    composioTriggerId,
    pausedReason: null,
    ...(webhook ? { webhookTokenHash: webhook.hash } : {}),
  });
  // A changed app event (or a trigger that is no longer an app event) leaves the old listener behind: stop it.
  if (w.composioTriggerId && w.composioTriggerId !== composioTriggerId) {
    await releaseAppTrigger(env, db, w.composioTriggerId, w.id);
  }
  return { ok: true, row: row!, webhookToken: webhook?.token ?? null };
}

async function listenForAppEvent(env: Env, userId: string, node: Extract<WorkflowNode, { kind: "trigger.app" }>) {
  const { toolkit, trigger, config, connectedAccountId } = node.config;
  try {
    const started = await startAppTrigger(env, userId, {
      toolkit: toolkit!,
      trigger: trigger!,
      config,
      connectedAccountId,
    });
    if ("error" in started) return { ...started, status: 422 as const, code: "NOT_READY" as const };
    return started;
  } catch (error) {
    console.error("[workflows] could not start app trigger", (error as Error).message);
    const message = `Could not start listening to ${toolkit}. Check the event's settings and try again.`;
    return { error: message, status: 502 as const, code: "UNAVAILABLE" as const };
  }
}

/**
 * Turns a workflow off: its schedule, webhook or app event stops starting runs (runs already going finish). `reason`
 * is set when the system does it, so the user sees why.
 */
export async function pauseWorkflow(env: Env, db: Db, userId: string, w: WorkflowRow, reason?: string) {
  const row = await setStatus(db, userId, w.id, {
    status: "paused",
    nextRunAt: null,
    composioTriggerId: null,
    pausedReason: reason ?? null,
  });
  if (w.composioTriggerId) await releaseAppTrigger(env, db, w.composioTriggerId, w.id);
  return row;
}

/**
 * Stops a Composio trigger instance, unless another workflow that is on still listens to it (Composio gives the same
 * instance back for the same event, account and settings).
 */
export async function releaseAppTrigger(env: Env, db: Db, triggerId: string, exceptWorkflowId: string) {
  const [stillUsed] = await db
    .select({ id: workflow.id })
    .from(workflow)
    .where(
      and(eq(workflow.composioTriggerId, triggerId), eq(workflow.status, "active"), ne(workflow.id, exceptWorkflowId)),
    )
    .limit(1);
  if (!stillUsed) await stopAppTrigger(env, triggerId);
}
