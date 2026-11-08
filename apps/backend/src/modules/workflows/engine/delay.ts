import type { WorkflowStep } from "cloudflare:workers";
import type { WorkflowNode } from "../graph/schema";
import { type NodeDeps, type NodeResult, once } from "./durable";

const SECONDS = { seconds: 1, minutes: 60, hours: 3600, days: 86400 } as const;
const MAX_DELAY_MS = 7 * 86_400_000;
const WAITED = { waited: true };

/**
 * The Delay block: a durable sleep. The Workflow instance is suspended (it costs nothing while it waits) and
 * survives deploys and restarts. A run cancelled before the wait starts never sleeps.
 */
export async function runDelay(
  step: WorkflowStep,
  { log }: NodeDeps,
  node: Extract<WorkflowNode, { kind: "logic.delay" }>,
): Promise<NodeResult> {
  const ms = Math.min(node.config.amount * SECONDS[node.config.unit] * 1000, MAX_DELAY_MS);

  const cancelled = await step.do(`wait:${node.id}`, async () => {
    if (await log.isCancelled()) return true;
    await log.step(node, { status: "waiting", resumeAt: new Date(Date.now() + ms) });
    return false;
  });
  if (cancelled) return { status: "cancelled" };

  await step.sleep(`sleep:${node.id}`, ms);
  await once(step, `woke:${node.id}`, () => log.step(node, { status: "succeeded", output: WAITED }));
  return { status: "succeeded", output: WAITED };
}
