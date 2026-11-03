import { toolErrorMiddleware } from "langchain";

/**
 * A failed tool call becomes a short error message the agent can react to, not a dead run. Pause/interrupt
 * signals are never converted. Outermost middleware of the bot and of every sub-agent.
 */
export const createToolErrorsMiddleware = () =>
  toolErrorMiddleware({
    onError: (error, request) =>
      `Tool '${request.toolCall.name}' failed: ${String((error as Error)?.message ?? error)
        .split("\n")[0]
        ?.slice(0, 200)}`,
  });
