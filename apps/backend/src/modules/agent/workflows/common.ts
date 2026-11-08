import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import { isTrigger } from "../../workflows/graph/schema";
import { publishIssues } from "../../workflows/graph/validate";
import type { WorkflowRow } from "../../workflows/store/workflows";

export type WorkflowToolContext = { env: Env; db: Db; userId: string; botId: string };

export const NOT_VISIBLE = "No such workflow is shared with this bot.";

/** A workflow as the model sees it: ids, status, what still blocks turning it on, and (optionally) its blocks. */
export function describeWorkflow(w: WorkflowRow, withGraph = false) {
  const summary = {
    id: w.id,
    name: w.name,
    description: w.description,
    status: w.status,
    trigger: w.triggerKind ?? w.graph.nodes.find(isTrigger)?.kind ?? null,
    issues: publishIssues(w.graph).slice(0, 8),
    url: `/workflows/${w.id}`,
  };
  if (!withGraph) return summary;
  // Canvas positions mean nothing to the model.
  const nodes = w.graph.nodes.map(({ position: _position, ...node }) => node);
  return { ...summary, graph: { nodes, edges: w.graph.edges } };
}

/** JSON for the model, cut at `max` characters so one tool result cannot flood its context. */
export function asText(value: unknown, max = 12_000) {
  const text = JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}… (cut)` : text;
}
