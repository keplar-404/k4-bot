import type { WorkflowStep } from "cloudflare:workers";
import type { WorkflowGraph, WorkflowNode } from "../graph/schema";
import { topoOrder } from "../graph/validate";
import { type NodeDeps, once } from "./durable";
import { type Outcome, shouldRun } from "./plan";
import { runNode } from "./run-node";
import type { RunContext } from "./template";

export type WalkResult = { status: "succeeded" | "cancelled" } | { status: "failed"; error: string; nodeId: string };

const continuesOnError = (node: WorkflowNode) => "onError" in node && node.onError === "continue";

/**
 * Runs the blocks in order. A block whose paths in were not taken is skipped. A failed block stops the run,
 * unless it is set to "continue on error".
 */
export async function runBlocks(
  step: WorkflowStep,
  deps: NodeDeps,
  graph: WorkflowGraph,
  ctx: RunContext,
): Promise<WalkResult> {
  const outcomes: Record<string, Outcome> = {};
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  // The runner validated the graph, and validation refuses loops, so there is always an order.
  const order = topoOrder(graph) ?? [];

  for (const node of order.map((id) => byId.get(id)!)) {
    if (!shouldRun(graph, outcomes, node.id)) {
      await once(step, `skip:${node.id}`, () => deps.log.step(node, { status: "skipped" }));
      outcomes[node.id] = { status: "skipped" };
      continue;
    }

    const result = await runNode(step, deps, node, ctx);
    if (result.status === "cancelled") return result;

    if (result.status === "succeeded") {
      ctx.steps[node.id] = { output: result.output };
      outcomes[node.id] = result;
      continue;
    }

    ctx.steps[node.id] = { output: null, error: result.error };
    if (continuesOnError(node)) {
      // The run goes on, and the blocks after this one still run (they can read its error).
      outcomes[node.id] = { status: "succeeded" };
      continue;
    }
    return { status: "failed", error: result.error, nodeId: node.id };
  }
  return { status: "succeeded" };
}
