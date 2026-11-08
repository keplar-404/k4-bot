import type { Env } from "../../../config/env";
import type { LiveEvent } from "./events";

export function liveRelay(env: Env, workflowId: string) {
  return env.WORKFLOW_LIVE.get(env.WORKFLOW_LIVE.idFromName(workflowId));
}

/**
 * Tells the workflow's open builders about a change. It never throws: a relay outage must not fail a run, and the
 * builder catches up from the database when it reconnects.
 */
export async function publishLive(env: Env, workflowId: string, event: LiveEvent) {
  try {
    await liveRelay(env, workflowId).broadcast(event);
  } catch (error) {
    console.error("[workflow-live] publish failed", event.type, error);
  }
}
