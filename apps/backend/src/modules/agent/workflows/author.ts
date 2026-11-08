import { tool } from "langchain";
import { z } from "zod";
import {
  createdByBotToday,
  grantBot,
  MAX_BOT_CREATIONS_PER_DAY,
  workflowOfBot,
} from "../../workflows/store/bot-access";
import { countWorkflows, createWorkflow, MAX_WORKFLOWS, saveDraft } from "../../workflows/store/workflows";
import { describeWorkflow, NOT_VISIBLE, type WorkflowToolContext } from "./common";
import { BLOCKS_HELP, edgesField, nodesField, TEMPLATES_HELP, toGraph } from "./draft";

export function createAuthorTools({ db, userId, botId }: WorkflowToolContext) {
  const createTool = tool(
    async ({ name, description, nodes, edges }) => {
      if ((await countWorkflows(db, userId)) >= MAX_WORKFLOWS) {
        return `The user already has ${MAX_WORKFLOWS} workflows.`;
      }
      if ((await createdByBotToday(db, botId)) >= MAX_BOT_CREATIONS_PER_DAY) {
        return `You made ${MAX_BOT_CREATIONS_PER_DAY} workflows today. Ask the user to continue tomorrow.`;
      }
      const result = toGraph(nodes, edges);
      if ("error" in result) return `The workflow is not valid: ${result.error}`;

      const created = await createWorkflow(db, userId, name, result.graph);
      if (description) await saveDraft(db, userId, created.id, { description });
      await grantBot(db, botId, created.id, true);
      return JSON.stringify(describeWorkflow({ ...created, description: description ?? "" }));
    },
    {
      name: "create_workflow",
      description: `Create a workflow as a DRAFT (nothing runs yet). ${BLOCKS_HELP} ${TEMPLATES_HELP} If it is rejected, fix it and try again.`,
      schema: z.object({
        name: z.string().trim().min(1).max(80),
        description: z.string().max(500).optional(),
        nodes: nodesField,
        edges: edgesField,
      }),
    },
  );

  const updateTool = tool(
    async ({ workflowId, nodes, edges }) => {
      const found = await workflowOfBot(db, userId, botId, workflowId);
      if (!found) return NOT_VISIBLE;
      const result = toGraph(nodes, edges);
      if ("error" in result) return `The workflow is not valid: ${result.error}`;

      // Saved only if nobody changed it since we read it: the user's own edits are never overwritten.
      const saved = await saveDraft(db, userId, found.id, { graph: result.graph }, found.updatedAt.toISOString());
      if (!saved) return "The user changed this workflow while you worked. Call get_workflow and try again.";
      return JSON.stringify(describeWorkflow(saved));
    },
    {
      name: "update_workflow",
      description: `Replace the DRAFT of a workflow you may use. A live workflow keeps running its published copy until turn_on_workflow. ${BLOCKS_HELP}`,
      schema: z.object({ workflowId: z.uuid(), nodes: nodesField, edges: edgesField }),
    },
  );

  return [createTool, updateTool];
}
