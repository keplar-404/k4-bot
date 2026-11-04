import { createAsyncTaskTools } from "../async-tasks/tools";
import type { BuildAgentOptions } from "./options";
import { createMemoryTools } from "./tools/memory";
import { createSandboxTools } from "./tools/sandbox";

/**
 * The tools a bot gets from what this run has: its code sandbox (coding bots), connected apps, long-term memory and
 * background tasks (bots that may use sub-agents may also delegate in the background).
 */
export function featureTools(options: BuildAgentOptions) {
  const { bot } = options;
  const asyncTasks = bot.subagentsEnabled ? options.asyncTasks : undefined;
  return {
    asyncTasks,
    tools: [
      ...(options.sandbox ? createSandboxTools({ env: options.sandbox.env, db: options.sandbox.db, userId: options.sandbox.userId, botId: bot.id }) : []),
      ...(options.apps?.tools ?? []),
      ...(options.memory ? createMemoryTools(options.memory) : []),
      ...(asyncTasks ? createAsyncTaskTools(asyncTasks) : []),
    ],
  };
}
