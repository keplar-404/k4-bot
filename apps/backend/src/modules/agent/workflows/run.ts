import { tool } from "langchain";
import { z } from "zod";
import { allow } from "../../../middleware/rate-limit";
import { RunStartError, startRun } from "../../workflows/engine/start";
import { triggerOf } from "../../workflows/graph/triggers";
import { workflowOfBot } from "../../workflows/store/bot-access";
import { publishWorkflow } from "../../workflows/store/publish";
import { setStatus } from "../../workflows/store/workflows";
import { describeWorkflow, NOT_VISIBLE, type WorkflowToolContext } from "./common";
import { waitForRun } from "./wait";

const inputsField = z.record(z.string().max(100), z.union([z.string().max(2000), z.number(), z.boolean()])).optional();

export function createRunTools({ env, db, userId, botId }: WorkflowToolContext) {
  const turnOn = tool(
    async ({ workflowId }) => {
      const found = await workflowOfBot(db, userId, botId, workflowId);
      if (!found) return NOT_VISIBLE;
      const result = await publishWorkflow(db, userId, found);
      if (!result.ok) return `Cannot turn it on: ${result.message}`;
      // The webhook token is shown to the user only, never to the model.
      const note = result.webhookToken ? "It has a webhook URL; only the user can see it, in the builder." : undefined;
      return JSON.stringify({ ...describeWorkflow(result.row), note });
    },
    {
      name: "turn_on_workflow",
      description:
        "Make a workflow live (its trigger starts working). Fails with the reason while it has unfinished blocks.",
      schema: z.object({ workflowId: z.uuid() }),
    },
  );

  const pause = tool(
    async ({ workflowId }) => {
      const found = await workflowOfBot(db, userId, botId, workflowId);
      if (!found) return NOT_VISIBLE;
      const paused = await setStatus(db, userId, found.id, { status: "paused", nextRunAt: null });
      return paused ? JSON.stringify(describeWorkflow(paused)) : NOT_VISIBLE;
    },
    {
      name: "pause_workflow",
      description: "Turn a workflow off: its schedule or webhook stops starting runs (runs already going finish).",
      schema: z.object({ workflowId: z.uuid() }),
    },
  );

  const run = tool(
    async ({ workflowId, inputs }) => {
      const found = await workflowOfBot(db, userId, botId, workflowId);
      if (!found) return NOT_VISIBLE;
      if (found.status !== "active" || !found.publishedGraph) {
        return "Turn the workflow on first (turn_on_workflow).";
      }
      if (triggerOf(found.publishedGraph)?.kind !== "trigger.manual") {
        return "Only workflows with a manual trigger can be run by a bot.";
      }
      if (!(await allow(env, "RL_WF_RUN", userId))) {
        return "Slow down: too many runs started. Try again in a minute.";
      }

      try {
        const started = await startRun(env, db, {
          workflowId: found.id,
          userId,
          trigger: "bot",
          graph: found.publishedGraph,
          input: { inputs: inputs ?? {} },
          botId,
        });
        return await waitForRun(db, userId, started.id);
      } catch (error) {
        if (error instanceof RunStartError) return error.message;
        throw error;
      }
    },
    {
      name: "run_workflow",
      description:
        "Run a live workflow that has a manual trigger. `inputs` are available as {{trigger.inputs.x}}. Waits up to 45 s for the result.",
      schema: z.object({ workflowId: z.uuid(), inputs: inputsField }),
    },
  );

  return [turnOn, pause, run];
}
