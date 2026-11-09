import type { WorkflowStep } from "cloudflare:workers";
import { nextOccurrence } from "../../schedules/next";
import type { WorkflowNode } from "../graph/schema";
import { toTime } from "./conditions/values";
import { type NodeDeps, type NodeResult, once } from "./durable";
import { resolve, type RunContext } from "./template";

type DelayNode = Extract<WorkflowNode, { kind: "logic.delay" }>;

const SECONDS = { seconds: 1, minutes: 60, hours: 3600, days: 86400 } as const;
const MAX_DELAY_MS = 7 * 86_400_000;

/** How long to wait from `now`, or why it cannot. A date already past waits 0 ms (the run goes on at once). */
export function delayMs(config: DelayNode["config"], ctx: RunContext, now = Date.now()): { ms: number } | { error: string } {
  if (config.mode === "for") return { ms: Math.min(config.amount * SECONDS[config.unit] * 1000, MAX_DELAY_MS) };
  let at: number | null;
  if (config.mode === "until") {
    at = toTime(resolve(config.until, ctx));
    if (at === null) return { error: "The date to wait until is not a date (use e.g. 2026-12-01T09:00:00Z)." };
  } else {
    at = nextOccurrence({ mode: "weekly", days: config.days, at: config.at, timezone: config.timezone, every: 1, unit: "weeks", dayOfMonth: 1 }, now)?.getTime() ?? null;
    if (at === null) return { error: "Could not work out the next time to wait for." };
  }
  const ms = Math.max(0, at - now);
  return ms > MAX_DELAY_MS ? { error: "A delay can wait at most 7 days ahead." } : { ms };
}

/**
 * The Delay block: a durable sleep. The Workflow instance is suspended (it costs nothing while it waits) and
 * survives deploys and restarts. The wait is worked out inside a step, so a resumed run sleeps until the same moment.
 * A run cancelled before the wait starts never sleeps.
 */
export async function runDelay(step: WorkflowStep, { log }: NodeDeps, node: DelayNode, ctx: RunContext, key = node.id): Promise<NodeResult> {
  const planned = await step.do(`wait:${key}`, async () => {
    if (await log.isCancelled()) return { cancelled: true as const };
    const wait = delayMs(node.config, ctx);
    if ("error" in wait) {
      await log.step(node, { status: "failed", error: wait.error });
      return { error: wait.error };
    }
    await log.step(node, { status: "waiting", resumeAt: new Date(Date.now() + wait.ms) });
    return { ms: wait.ms };
  });
  if ("cancelled" in planned) return { status: "cancelled" };
  if ("error" in planned) return { status: "failed", error: planned.error! };

  if (planned.ms! > 0) await step.sleep(`sleep:${key}`, planned.ms!);
  const output = { waited: true, ms: planned.ms };
  await once(step, `woke:${key}`, () => log.step(node, { status: "succeeded", output }));
  return { status: "succeeded", output };
}
