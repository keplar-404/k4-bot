import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { parseEnv, type Env } from "../../../config/env";
import { createDb, type Db } from "../../../db";
import { workflow } from "../../../db/schema";
import { graphSchema, type WorkflowGraph } from "../graph/schema";
import { structureIssues } from "../graph/validate";
import { getRun } from "../store/runs";
import { type NodeDeps, once } from "./durable";
import { userMessage } from "./errors";
import type { RunParams } from "./params";
import { RunLog } from "./run-log";
import type { RunContext } from "./template";
import { runBlocks } from "./walk";

/**
 * WorkflowRunner: one run of a workflow, block by block in order. It runs the graph saved on the run (a snapshot),
 * not the live workflow, so editing never changes a run in flight. The graph is validated again here: this is the
 * trust boundary, whatever put it in the database.
 */
export class WorkflowRunner extends WorkflowEntrypoint<Env, RunParams> {
  async run(event: WorkflowEvent<RunParams>, step: WorkflowStep) {
    const params = event.payload;
    const env = parseEnv(this.env);
    const db = createDb(env.DATABASE_URL);
    const log = new RunLog(db, env, params);
    const fail = (error: string, failedNodeId?: string) =>
      once(step, `fail-run:${failedNodeId ?? "run"}`, () => log.finish("failed", { error, failedNodeId }));

    try {
      const startedAt = await step.do("start", async () => ((await log.start()) ? new Date().toISOString() : null));
      if (!startedAt) return { status: "skipped" };

      const loaded = await loadGraph(db, params);
      if ("error" in loaded) {
        await fail(loaded.error);
        return { status: "failed" };
      }

      const ctx: RunContext = {
        trigger: loaded.input ?? {},
        steps: {},
        run: { id: params.runId, startedAt },
      };
      const deps: NodeDeps = { env, db, log, run: { id: params.runId, userId: params.userId } };
      const result = await runBlocks(step, deps, loaded.graph, ctx);

      if (result.status === "failed") await fail(result.error, result.nodeId);
      if (result.status === "succeeded") {
        await once(step, "finish", async () => {
          await log.finish("succeeded");
          // Not setStatus(): that bumps updatedAt, and an open builder tab would report a false edit conflict.
          await db.update(workflow).set({ lastRunAt: new Date() }).where(eq(workflow.id, params.workflowId));
        });
      }
      return { status: result.status };
    } catch (error) {
      console.error("[workflow-run] crashed", params.runId, error);
      await fail(userMessage(error));
      return { status: "failed" };
    }
  }
}

/**
 * The run's saved graph and input. Read outside a step on purpose: a graph can be larger than a step's result may
 * be (1 MiB), and reading it again on resume is harmless.
 */
async function loadGraph(
  db: Db,
  params: RunParams,
): Promise<{ error: string } | { graph: WorkflowGraph; input: unknown }> {
  const run = await getRun(db, params.userId, params.runId);
  if (!run) return { error: "The run no longer exists." };

  const parsed = graphSchema.safeParse(run.graph);
  if (!parsed.success) return { error: "The workflow is not valid." };
  const problem = structureIssues(parsed.data)[0];
  if (problem) return { error: problem.message };
  return { graph: parsed.data, input: run.input };
}
