import { isTrigger, LIMITS, type WorkflowGraph } from "./schema";

/** A problem with the graph, pinned to a block when it is about one (the builder highlights it). */
export type GraphIssue = { nodeId?: string; message: string };

/** Blocks in run order, or null when the connections form a loop (Kahn's algorithm). */
export function topoOrder(g: WorkflowGraph): string[] | null {
  const incoming = new Map(g.nodes.map((n) => [n.id, 0]));
  for (const e of g.edges) incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);

  const ready = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const e of g.edges) {
      if (e.source !== id) continue;
      const left = (incoming.get(e.target) ?? 0) - 1;
      incoming.set(e.target, left);
      if (left === 0) ready.push(e.target);
    }
  }
  return order.length === g.nodes.length ? order : null;
}

/**
 * Rules every saved graph must follow, even an unfinished draft. Loops are refused here, so no workflow can ever
 * run forever by its own design.
 */
export function structureIssues(g: WorkflowGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const kinds = new Map<string, string>();
  for (const n of g.nodes) {
    if (kinds.has(n.id)) issues.push({ nodeId: n.id, message: "Two blocks share this id." });
    kinds.set(n.id, n.kind);
    if (n.kind === "action.app" && JSON.stringify(n.config.arguments).length > LIMITS.argBytes) {
      issues.push({ nodeId: n.id, message: "This block's settings are too large." });
    }
  }

  const seen = new Set<string>();
  for (const e of g.edges) {
    if (!kinds.has(e.source) || !kinds.has(e.target)) {
      issues.push({ message: "A connection points to a block that does not exist." });
    }
    if (e.source === e.target) {
      issues.push({ nodeId: e.source, message: "A block cannot connect to itself." });
    }
    if (kinds.get(e.target)?.startsWith("trigger.")) {
      issues.push({ nodeId: e.target, message: "A trigger starts the workflow: nothing can lead into it." });
    }
    if ((kinds.get(e.source) === "logic.if") !== Boolean(e.branch)) {
      issues.push({ nodeId: e.source, message: "Only an If block has true / false paths." });
    }
    const key = `${e.source}>${e.target}>${e.branch ?? ""}`;
    if (seen.has(key)) issues.push({ nodeId: e.source, message: "The same connection exists twice." });
    seen.add(key);
  }

  if (g.nodes.filter(isTrigger).length > 1) issues.push({ message: "A workflow has one trigger." });
  if (issues.length === 0 && topoOrder(g) === null) {
    issues.push({
      message: "The connections form a loop. Workflows run from the trigger forward, without loops.",
    });
  }
  return issues;
}
