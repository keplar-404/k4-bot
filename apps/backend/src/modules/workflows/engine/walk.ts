import type { WorkflowStep } from "cloudflare:workers";
import { ancestors, loopOf } from "../graph/loop-rules";
import { isTrigger, type WorkflowGraph, type WorkflowNode } from "../graph/schema";
import { topoOrder } from "../graph/validate";
import { type NodeDeps, once } from "./durable";
import { checkLoopSize } from "./loop";
import { type Outcome, shouldRun } from "./plan";
import { runNode } from "./run-node";
import type { RunContext } from "./template";

/** Test runs only: pinned outputs used instead of running those blocks, and the block a "test this step" ends at. */
export type TestOptions = { pins: Record<string, unknown>; stopAfter?: string };

export type WalkResult = { status: "succeeded" | "cancelled" } | { status: "failed"; error: string; nodeId: string };

const continuesOnError = (node: WorkflowNode) => "onError" in node && node.onError === "continue";

/** One pass's result: the output of the last repeated block that ran (null when none did). */
function lastOutput(body: WorkflowNode[], outcomes: Record<string, Outcome>, ctx: RunContext) {
  const last = body.findLast((n) => outcomes[n.id]?.status === "succeeded");
  return last ? (ctx.steps[last.id]?.output ?? null) : null;
}

/**
 * Runs the blocks in order. A block whose paths in were not taken is skipped. A failed block stops the run,
 * unless it is set to "continue on error". The blocks after a For each run once per item, one item after another.
 */
export async function runBlocks(
  step: WorkflowStep,
  deps: NodeDeps,
  graph: WorkflowGraph,
  ctx: RunContext,
  test: TestOptions = { pins: {} },
): Promise<WalkResult> {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  // The runner validated the graph, and validation refuses cycles, so there is always an order.
  const order = (topoOrder(graph) ?? []).map((id) => byId.get(id)!);
  const loop = loopOf(graph);
  const body = order.filter((node) => loop?.body.has(node.id));
  const after = order.filter((node) => loop?.after.has(node.id));

  // "Test this step": only that block and the blocks before it run.
  const needed = test.stopAfter ? new Set([test.stopAfter, ...ancestors(graph, test.stopAfter)]) : null;

  async function runSequence(nodes: WorkflowNode[], outcomes: Record<string, Outcome>, pass: string) {
    for (const node of nodes) {
      const key = node.id + pass;
      if ((needed && !needed.has(node.id)) || !shouldRun(graph, outcomes, node.id)) {
        await once(step, `skip:${key}`, () => deps.log.step(node, { status: "skipped" }));
        outcomes[node.id] = { status: "skipped" };
        continue;
      }

      const result = node.id in test.pins ? await usePin(node, key) : await runNode(step, deps, node, ctx, key);
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

  /** A pinned block is not run: its pinned output stands in (a pinned trigger also sets what the trigger handed in). */
  async function usePin(node: WorkflowNode, key: string) {
    const output = test.pins[node.id];
    if (isTrigger(node)) ctx.trigger = output;
    await once(step, `pin:${key}`, () => deps.log.step(node, { status: "succeeded", input: { pinned: true }, output }));
    return { status: "succeeded" as const, output };
  }

  const outcomes: Record<string, Outcome> = {};
  const main = await runSequence(
    order.filter((node) => !loop?.body.has(node.id) && !loop?.after.has(node.id)),
    outcomes,
    "",
  );
  if (main.status !== "succeeded" || !loop) return main;
  // The loop did not run (its path was not taken): the blocks after Done are skipped the same way.
  if (outcomes[loop.loop.id]?.status !== "succeeded") return runSequence(after, outcomes, "");

  // The passes run after every other block, so a repeated block can also read blocks outside the loop.
  const { items } = ctx.steps[loop.loop.id]!.output as { items: unknown[] };
  const tooMany = checkLoopSize(items.length, body.length);
  if (tooMany) return { status: "failed", error: tooMany, nodeId: loop.loop.id };
  const results: unknown[] = [];
  for (const [index, item] of items.entries()) {
    ctx.loop = { item, index, count: items.length };
    // Each pass starts from the outcomes before the loop, so an If inside it decides per item.
    const passOutcomes = { ...outcomes };
    const ended = await runSequence(body, passOutcomes, `#${index}`);
    if (ended.status !== "succeeded") return ended;
    results.push(lastOutput(body, passOutcomes, ctx));
  }
  ctx.loop = undefined;
  // After Done: {{steps.<loop>.output.results}} holds each item's result (the last block that ran in its pass).
  ctx.steps[loop.loop.id] = { output: { ...(ctx.steps[loop.loop.id]!.output as object), results } };
  return runSequence(after, outcomes, "");
}
