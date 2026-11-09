import type { WorkflowStep } from "cloudflare:workers";
import { loopOf } from "../graph/loop-rules";
import type { WorkflowGraph, WorkflowNode } from "../graph/schema";
import { topoOrder } from "../graph/validate";
import { type NodeDeps, once } from "./durable";
import { checkLoopSize } from "./loop";
import { type Outcome, shouldRun } from "./plan";
import { runNode } from "./run-node";
import type { RunContext } from "./template";

export type WalkResult = { status: "succeeded" | "cancelled" } | { status: "failed"; error: string; nodeId: string };

const continuesOnError = (node: WorkflowNode) => "onError" in node && node.onError === "continue";

/**
 * Runs the blocks in order. A block whose paths in were not taken is skipped. A failed block stops the run,
 * unless it is set to "continue on error". The blocks after a For each run once per item, one item after another.
 */
export async function runBlocks(
  step: WorkflowStep,
  deps: NodeDeps,
  graph: WorkflowGraph,
  ctx: RunContext,
): Promise<WalkResult> {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  // The runner validated the graph, and validation refuses cycles, so there is always an order.
  const order = (topoOrder(graph) ?? []).map((id) => byId.get(id)!);
  const loop = loopOf(graph);
  const body = order.filter((node) => loop?.body.has(node.id));

  async function runSequence(nodes: WorkflowNode[], outcomes: Record<string, Outcome>, pass: string) {
    for (const node of nodes) {
      const key = node.id + pass;
      if (!shouldRun(graph, outcomes, node.id)) {
        await once(step, `skip:${key}`, () => deps.log.step(node, { status: "skipped" }));
        outcomes[node.id] = { status: "skipped" };
        continue;
      }

      const result = await runNode(step, deps, node, ctx, key);
      if (result.status === "cancelled") return result;

      if (result.status === "failed") {
        ctx.steps[node.id] = { output: null, error: result.error };
        if (!continuesOnError(node)) return { status: "failed" as const, error: result.error, nodeId: node.id };
        // The run goes on, and the blocks after this one still run (they can read its error).
        outcomes[node.id] = { status: "succeeded" };
        continue;
      }

      ctx.steps[node.id] = { output: result.output };
      outcomes[node.id] = result;
    }
    return { status: "succeeded" as const };
  }

  const outcomes: Record<string, Outcome> = {};
  const main = await runSequence(
    order.filter((node) => !loop?.body.has(node.id)),
    outcomes,
    "",
  );
  if (main.status !== "succeeded" || !loop || outcomes[loop.loop.id]?.status !== "succeeded") return main;

  // The passes run after every other block, so a repeated block can also read blocks outside the loop.
  const { items } = ctx.steps[loop.loop.id]!.output as { items: unknown[] };
  const tooMany = checkLoopSize(items.length, body.length);
  if (tooMany) return { status: "failed", error: tooMany, nodeId: loop.loop.id };
  for (const [index, item] of items.entries()) {
    ctx.loop = { item, index, count: items.length };
    // Each pass starts from the outcomes before the loop, so an If inside it decides per item.
    const ended = await runSequence(body, { ...outcomes }, `#${index}`);
    if (ended.status !== "succeeded") return ended;
  }
  ctx.loop = undefined;
  return { status: "succeeded" };
}
