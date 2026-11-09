import type { Env } from "../../../config/env";
import type { Db } from "../../../db";
import { liveRelay } from "../live/publish";
import { releaseAppTrigger } from "./publish";
import { activeRunIds, stopRuns } from "./run-control";
import { deleteWorkflow, type WorkflowRow } from "./workflows";

/**
 * Deletes a workflow and everything that would keep it going: its app-event listener, its runs (they would keep
 * calling apps) and its open builders. One path for the user's Delete and a bot's delete_workflow.
 */
export async function removeWorkflow(env: Env, db: Db, userId: string, found: WorkflowRow) {
  const running = await activeRunIds(db, userId, found.id);
  if (!(await deleteWorkflow(db, userId, found.id))) return false;
  if (found.composioTriggerId) await releaseAppTrigger(env, db, found.composioTriggerId, found.id);
  await stopRuns(env, running);
  await liveRelay(env, found.id)
    .closeAll()
    .catch((error) => console.error("[workflows] live sockets not closed", error));
  return true;
}
