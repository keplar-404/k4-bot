import { LOOP_DONE } from "./loop-rules";
import { isTrigger, LIMITS, type WorkflowGraph } from "./schema";
import { OTHERWISE } from "./switch-block";

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
    if (kinds.get(e.source) === "logic.return") {
      issues.push({ nodeId: e.source, message: "Return ends the workflow: nothing comes after it." });
    }
    if (kinds.get(e.target)?.startsWith("trigger.")) {
      issues.push({ nodeId: e.target, message: "A trigger starts the workflow: nothing can lead into it." });
    }
    const branchIssue = branchProblem(g, e);
    if (branchIssue) issues.push({ nodeId: e.source, message: branchIssue });
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

/** Which outputs a block has: If → true/false, Switch → its rules and "otherwise", For each → each item and "done", others → one. */
function branchProblem(g: WorkflowGraph, e: WorkflowGraph["edges"][number]): string | null {
  const source = g.nodes.find((n) => n.id === e.source);
  if (source?.kind === "logic.if") {
    return e.branch === "true" || e.branch === "false" ? null : "Connect an If block from its true or false output.";
  }
  if (source?.kind === "logic.switch") {
    const outputs = new Set([...source.config.rules.map((r) => r.id), ...(source.config.otherwise ? [OTHERWISE] : [])]);
    return e.branch && outputs.has(e.branch) ? null : "This connection leaves from a Switch output that no longer exists.";
  }
  if (source?.kind === "logic.loop") {
    return !e.branch || e.branch === LOOP_DONE ? null : "Connect a For each from its each-item or done output.";
  }
  return e.branch ? "Only If, Switch and For each blocks have several outputs." : null;
}
