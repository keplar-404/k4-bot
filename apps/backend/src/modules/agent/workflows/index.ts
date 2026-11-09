import { createAuthorTools } from "./author";
import type { WorkflowToolContext } from "./common";
import { createConnectAppsTool } from "./connect-apps";
import { createReadTools } from "./read";
import { createRunTools } from "./run";

export type { WorkflowToolContext } from "./common";

/** The bot's workflow tools. The ones that start something (turn on, run) ask first in Ask mode (account-tools.ts). */
export function createWorkflowTools(ctx: WorkflowToolContext) {
  return [...createReadTools(ctx), ...createAuthorTools(ctx), ...createRunTools(ctx), createConnectAppsTool(ctx)];
}
