import { tool } from "langchain";
import { z } from "zod";
import { allow } from "../../../middleware/rate-limit";
import { missingApps, toolkitsOf } from "../../composio/requirements";
import { RunStartError, startRun } from "../../workflows/engine/start";
import { readForm } from "../../workflows/graph/manual-form";
import { triggerOf } from "../../workflows/graph/triggers";
import { ownWorkflowOfBot, workflowOfBot } from "../../workflows/store/bot-access";
import { pauseWorkflow, publishWorkflow } from "../../workflows/store/publish";
import { removeWorkflow } from "../../workflows/store/remove";
import { describeWorkflow, NOT_VISIBLE, NOT_YOURS, type WorkflowToolContext } from "./common";
import { waitForRun } from "./wait";

const inputsField = z.record(z.string().max(100), z.union([z.string().max(2000), z.number(), z.boolean(), z.array(z.string().max(500)).max(100)])).optional();

export function createRunTools({ env, db, userId, botId }: WorkflowToolContext) {
  const turnOn = tool(
    async ({ workflowId }) => {
      const found = await ownWorkflowOfBot(db, userId, botId, workflowId);
      if (!found) return (await workflowOfBot(db, userId, botId, workflowId)) ? NOT_YOURS : NOT_VISIBLE;
      const missing = await missingApps(env, db, userId, toolkitsOf(found.graph));
      if (missing.length) {
        const slugs = missing.map((a) => a.toolkit).join(", ");
        return `Cannot turn it on yet: the user has not connected ${slugs}. Call request_app_connections with these apps first.`;
      }
      const result = await publishWorkflow(env, db, userId, found);
      if (!result.ok) return `Cannot turn it on: ${result.message}`;
      // The webhook token is shown to the user only, never to the model.
      const note = result.webhookToken ? "It has a webhook URL; only the user can see it, in the builder." : undefined;
      return JSON.stringify({ ...describeWorkflow(result.row), note });
    },
    {
      name: "turn_on_workflow",
      description:
        "Make a workflow YOU created live (its trigger starts working). Fails with the reason while it has unfinished blocks or apps that are not connected. Workflows only shared with you cannot be turned on by you.",
      schema: z.object({ workflowId: z.uuid() }),
    },
  );

  const pause = tool(
    async ({ workflowId }) => {
      const found = await ownWorkflowOfBot(db, userId, botId, workflowId);
      if (!found) return (await workflowOfBot(db, userId, botId, workflowId)) ? NOT_YOURS : NOT_VISIBLE;
      const paused = await pauseWorkflow(env, db, userId, found);
      return paused ? JSON.stringify(describeWorkflow(paused)) : NOT_VISIBLE;
    },
    {
      name: "pause_workflow",
      description:
        "Turn a workflow YOU created off: its schedule or webhook stops starting runs (runs already going finish).",
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
      const trigger = triggerOf(found.publishedGraph);
      if (trigger?.kind !== "trigger.manual") {
        return "Only workflows with a manual trigger can be run by a bot.";
      }
      const form = readForm(trigger.config.fields, inputs ?? {});
      if ("problems" in form) return `Not started: ${form.problems.join(" ")} (see the workflow's inputs with get_workflow).`;
      if (!(await allow(env, "RL_WF_RUN", userId))) {
        return "Slow down: too many runs started. Try again in a minute.";
      }

      try {
        const started = await startRun(env, db, {
          workflowId: found.id,
          userId,
          trigger: "bot",
          graph: found.publishedGraph,
          input: form,
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

  const remove = tool(
    async ({ workflowId }) => {
      const found = await ownWorkflowOfBot(db, userId, botId, workflowId);
      if (!found) return (await workflowOfBot(db, userId, botId, workflowId)) ? NOT_YOURS : NOT_VISIBLE;
      return (await removeWorkflow(env, db, userId, found)) ? "Deleted." : NOT_VISIBLE;
    },
    {
      name: "delete_workflow",
      description: "Delete a workflow YOU created (it stops listening and its running runs are stopped). Cannot be undone.",
      schema: z.object({ workflowId: z.uuid() }),
    },
  );

  return [turnOn, pause, run, remove];
}
