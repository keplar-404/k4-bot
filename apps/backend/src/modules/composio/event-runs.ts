import { and, eq } from "drizzle-orm";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { workflow } from "../../db/schema";
import { allow } from "../../middleware/rate-limit";
import { RunStartError, startRun } from "../workflows/engine/start";
import { triggerOf } from "../workflows/graph/triggers";
import { stopIfSelfTriggering } from "./auto-pause";

export type TriggerEvent = { triggerId: string; userId: string; slug: string; data: Record<string, unknown> };

/** Starts a run of every workflow that is on and listens on the event's trigger instance, for that same user. */
export async function startListeningWorkflows(env: Env, db: Db, event: TriggerEvent, eventId: string) {
  const listeners = await db
    .select()
    .from(workflow)
    .where(
      and(
        eq(workflow.composioTriggerId, event.triggerId),
        eq(workflow.userId, event.userId),
        eq(workflow.status, "active"),
      ),
    );

  let started = 0;
  for (const w of listeners) {
    // A workflow whose own actions cause the event it listens for would run forever: it is turned off when it looks
    // like that, and the per-workflow rate limit and daily caps bound it until then.
    const trigger = triggerOf(w.publishedGraph ?? { nodes: [], edges: [] });
    const toolkit = trigger?.kind === "trigger.app" ? trigger.config.toolkit : undefined;
    if (toolkit && (await stopIfSelfTriggering(env, db, w, toolkit))) continue;
    if (!(await allow(env, "RL_WF_HOOK", `app:${w.id}`))) {
      console.warn("[composio-events] rate limited", w.id);
      continue;
    }
    try {
      await startRun(env, db, {
        workflowId: w.id,
        userId: event.userId,
        trigger: "app",
        graph: w.publishedGraph,
        input: { event: event.slug, data: event.data, eventId, receivedAt: new Date().toISOString() },
      });
      started++;
    } catch (error) {
      // A cap reached is the user's limit, not a delivery failure: Composio must not retry for it.
      if (!(error instanceof RunStartError)) throw error;
      console.warn("[composio-events] run not started", w.id, error.code);
    }
  }
  return started;
}
