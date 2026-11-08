import { tool } from "langchain";
import { z } from "zod";
import { workflowOfBot, workflowsOfBot } from "../../workflows/store/bot-access";
import { getRun } from "../../workflows/store/runs";
import { asText, describeWorkflow, NOT_VISIBLE, type WorkflowToolContext } from "./common";

export function createReadTools({ db, userId, botId }: WorkflowToolContext) {
  const listTool = tool(
    async () => {
      const visible = await workflowsOfBot(db, userId, botId);
      return asText(visible.map((w) => describeWorkflow(w)));
    },
    {
      name: "list_my_workflows",
      description:
        "The workflows you may use: shared with you by the user, or made by you. Name, id, status (draft/active/paused), trigger, and what still blocks turning it on.",
      schema: z.object({}),
    },
  );

  const getTool = tool(
    async ({ workflowId }) => {
      const found = await workflowOfBot(db, userId, botId, workflowId);
      return found ? asText(describeWorkflow(found, true)) : NOT_VISIBLE;
    },
    {
      name: "get_workflow",
      description: "One workflow with its blocks and connections.",
      schema: z.object({ workflowId: z.uuid() }),
    },
  );

  const statusTool = tool(
    async ({ runId }) => {
      const run = await getRun(db, userId, runId);
      if (!run || run.startedByBotId !== botId) return "No such run started by this bot.";
      return asText({
        status: run.status,
        error: run.error,
        failedNodeId: run.failedNodeId,
        steps: run.steps.map((s) => ({ nodeId: s.nodeId, status: s.status, error: s.error })),
      });
    },
    {
      name: "workflow_run_status",
      description: "How a run you started is going: its status, the failed block and the error.",
      schema: z.object({ runId: z.uuid() }),
    },
  );

  return [listTool, getTool, statusTool];
}
