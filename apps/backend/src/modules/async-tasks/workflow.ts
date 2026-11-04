import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { parseEnv, type Env } from "../../config/env";
import { createDb } from "../../db";
import { agentUsage } from "../../db/schema";
import { DEFAULT_MODEL_ID } from "../agent/models";
import { publishEvent } from "../chat/run/relay";
import { registryFor } from "./registry-stub";
import { runTask, type TaskParams } from "./run-task";

/**
 * One background task (start_async_task), as its own Workflow: it runs while the parent bot keeps talking to the user,
 * and survives the parent's run ending. No automatic retry: a half-done research run would be paid for twice.
 * When it ends, the registry records the result and the chat gets an `async.task` event.
 */
export class AsyncTaskWorkflow extends WorkflowEntrypoint<Env, TaskParams> {
  async run(event: WorkflowEvent<TaskParams>, step: WorkflowStep) {
    const p = event.payload;
    const env = parseEnv(this.env);
    const registry = registryFor(env, p.threadId);
    const outcome = await step.do("task", { retries: { limit: 0, delay: 1 }, timeout: "15 minutes" }, async () => {
      try {
        const r = await runTask(env, p, registry);
        if (r.usage.input + r.usage.output > 0) {
          await createDb(env.DATABASE_URL)
            .insert(agentUsage)
            .values({ userId: p.userId, threadId: p.threadId, runId: `task:${p.taskId}`, model: p.modelId ?? DEFAULT_MODEL_ID, inputTokens: r.usage.input, outputTokens: r.usage.output })
            .catch((e: unknown) => console.error("[async-task] usage not recorded", e));
        }
        return { status: "success" as const, result: r.report };
      } catch (error) {
        return { status: "error" as const, result: error instanceof Error ? error.message : String(error) };
      }
    });
    await step.do("finish", async () => {
      await registry.finish(p.taskId, outcome.status, outcome.result.slice(0, 20_000));
      await publishEvent(env, p.threadId, "async.task", { taskId: p.taskId, agent: p.agent, status: outcome.status });
    });
  }
}
