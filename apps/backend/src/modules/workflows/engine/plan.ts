import type { WorkflowEdge, WorkflowGraph } from "../graph/schema";

/** How a finished block ended, as far as the blocks after it care. */
export type Outcome = {
  status: "succeeded" | "failed" | "skipped";
  /** An If block's answer: which of its two paths is taken. */
  ifResult?: boolean;
  /** A Filter block's answer: false stops the path after it. */
  passed?: boolean;
};

/**
 * Whether a block runs, given how the blocks before it ended. The trigger (no incoming connection) always runs;
 * any other block runs when at least one connection into it is taken. A block on the untaken side of an If, or
 * after a Filter that stopped, is skipped.
 */
export function shouldRun(graph: WorkflowGraph, outcomes: Record<string, Outcome>, nodeId: string) {
  const incoming = graph.edges.filter((edge) => edge.target === nodeId);
  if (incoming.length === 0) return true;
  return incoming.some((edge) => isTaken(edge, outcomes[edge.source]));
}

function isTaken(edge: WorkflowEdge, source: Outcome | undefined) {
  if (source?.status !== "succeeded") return false;
  if (edge.branch) return source.ifResult === (edge.branch === "true");
  return source.passed !== false;
}
