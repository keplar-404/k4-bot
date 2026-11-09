import { graphSchema } from "../graph/schema";
import { publishIssues } from "../graph/validate";
import type { WorkflowRow } from "../store/workflows";

/** A workflow as the web app receives it: never the owner id or the webhook token hash. */
export function workflowDto(w: WorkflowRow) {
  // Through the schema, so a graph saved before a setting existed comes back with that setting's default.
  const graph = graphSchema.safeParse(w.graph).data ?? w.graph;
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    status: w.status,
    graph,
    publishedVersion: w.publishedVersion,
    triggerKind: w.triggerKind,
    hasWebhook: Boolean(w.webhookTokenHash),
    nextRunAt: w.nextRunAt,
    pausedReason: w.pausedReason,
    lastRunAt: w.lastRunAt,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    /** True when the draft differs from what is live, so the builder can say "unpublished changes". */
    hasUnpublishedChanges: w.publishedGraph !== null && JSON.stringify(w.publishedGraph) !== JSON.stringify(w.graph),
    /** What still blocks turning it on (empty when it can be published). */
    issues: publishIssues(graph),
  };
}
