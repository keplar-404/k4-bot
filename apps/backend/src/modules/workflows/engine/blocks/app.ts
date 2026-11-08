import type { Env } from "../../../../config/env";
import { executeAction } from "../../../composio/execute";
import type { WorkflowNode } from "../../graph/schema";
import { FatalBlockError } from "../errors";

type AppConfig = Extract<WorkflowNode, { kind: "action.app" }>["config"];

const MAX_OUTPUT_CHARS = 64 * 1024;

/**
 * The connected-app (Composio) block. `args` are already filled in. It runs as the workflow's owner, with their own
 * ACTIVE account for that app.
 */
export async function runApp(env: Env, userId: string, config: AppConfig, args: Record<string, unknown>) {
  if (!config.toolkit || !config.tool) throw new FatalBlockError("Choose an app and an action.");

  const result = await executeAction(env, {
    userId,
    toolkit: config.toolkit,
    slug: config.tool,
    version: config.version,
    arguments: args,
    connectedAccountId: config.connectedAccountId,
    maxChars: MAX_OUTPUT_CHARS,
  });
  if (result.ok) return result.data;
  throw result.fatal ? new FatalBlockError(result.error) : new Error(result.error);
}
