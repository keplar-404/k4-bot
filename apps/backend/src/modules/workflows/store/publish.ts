import type { Db } from "../../../db";
import { newWebhookToken, nextRunAt, triggerOf } from "../graph/triggers";
import { type GraphIssue, publishIssues } from "../graph/validate";
import { countWorkflows, MAX_ACTIVE, setStatus, type WorkflowRow } from "./workflows";

export type PublishResult =
  | { ok: true; row: WorkflowRow; webhookToken: string | null }
  | { ok: false; status: 409 | 422; error: "NOT_READY" | "LIMIT"; message: string; issues?: GraphIssue[] };

/**
 * Turns a workflow on: re-validates the whole draft, freezes it as the copy that runs, and (webhook trigger) makes the
 * secret token, returned once. One code path for the Turn on button and for a bot's turn_on_workflow.
 */
export async function publishWorkflow(db: Db, userId: string, w: WorkflowRow): Promise<PublishResult> {
  const issues = publishIssues(w.graph);
  if (issues.length) return { ok: false, status: 422, error: "NOT_READY", message: issues[0]!.message, issues };
  if (w.status !== "active" && (await countWorkflows(db, userId, "active")) >= MAX_ACTIVE) {
    return {
      ok: false,
      status: 409,
      error: "LIMIT",
      message: `Up to ${MAX_ACTIVE} workflows can be on at once. Turn one off first.`,
    };
  }
  const trigger = triggerOf(w.graph);
  const webhook = trigger?.kind === "trigger.webhook" && !w.webhookTokenHash ? await newWebhookToken() : null;
  const row = await setStatus(db, userId, w.id, {
    status: "active",
    publishedGraph: w.graph,
    publishedVersion: w.publishedVersion + 1,
    triggerKind: trigger?.kind ?? null,
    nextRunAt: nextRunAt(trigger),
    ...(webhook ? { webhookTokenHash: webhook.hash } : {}),
  });
  return { ok: true, row: row!, webhookToken: webhook?.token ?? null };
}
