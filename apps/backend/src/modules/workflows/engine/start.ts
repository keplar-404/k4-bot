import { eq } from "drizzle-orm";
import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import { workflowRun } from "../../../db/schema";
import { graphSchema } from "../graph/schema";
import { runIssue } from "../graph/validate";
import { createRun, type RunTrigger } from "../store/runs";
import { getWorkflow } from "../store/workflows";
import { checkCaps, RUN_LIMITS } from "./caps";
import type { RunParams } from "./params";
import { RunStartError } from "./start-error";

export { RUN_LIMITS } from "./caps";
export { RunStartError } from "./start-error";

export type StartArgs = {
  workflowId: string;
  userId: string;
  trigger: RunTrigger;
  graph: unknown;
  input?: unknown;
  botId?: string;
};

/**
 * The one way a run starts (manual, test, schedule, webhook, bot). It validates the graph again (the engine never
 * runs what the schema does not accept), enforces the caps, saves the run, then starts its Workflow instance.
 *
 * shortcut: two requests at the same instant can both pass the cap check; the overshoot is bounded by the 10/min
 * run rate limit. Upgrade to an advisory lock if exact caps matter.
 */
export async function startRun(env: Env, db: Db, args: StartArgs) {
  if (JSON.stringify(args.input ?? null).length > RUN_LIMITS.inputBytes) {
    throw new RunStartError("TOO_LARGE", "The input is too large (256 KB at most).");
  }
  const found = await getWorkflow(db, args.userId, args.workflowId);
  if (!found) throw new RunStartError("NOT_FOUND", "Workflow not found.");

  const parsed = graphSchema.safeParse(args.graph);
  if (!parsed.success) throw new RunStartError("NOT_READY", "The workflow is not valid.");
  const issue = runIssue(parsed.data);
  if (issue) throw new RunStartError("NOT_READY", issue.message);

  await checkCaps(db, args.userId, args.botId);

  const run = await createRun(db, {
    workflowId: found.id,
    userId: found.userId,
    version: found.publishedVersion,
    trigger: args.trigger,
    graph: parsed.data,
    input: args.input,
    botId: args.botId,
  });
  const params: RunParams = { runId: run.id, workflowId: found.id, userId: found.userId };
  try {
    await env.WORKFLOW_RUN.create({ id: run.id, params });
  } catch (error) {
    console.error("[workflow] could not start the run instance", error);
    await db
      .update(workflowRun)
      .set({ status: "failed", error: "Could not start", finishedAt: new Date() })
      .where(eq(workflowRun.id, run.id));
    throw new RunStartError("UNAVAILABLE", "Could not start the run. Try again in a moment.");
  }
  return run;
}
