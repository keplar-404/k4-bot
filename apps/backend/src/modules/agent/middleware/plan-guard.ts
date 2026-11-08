import { ToolMessage } from "@langchain/core/messages";
import { createMiddleware } from "langchain";

const REFUSAL =
  "Plan mode: this action is not allowed. Finish the plan, then call request_mode_switch to ask the user to switch modes.";

/**
 * Plan mode, enforced in code twice: the model is only OFFERED tools `allows` accepts, and a call to any other tool
 * (a hallucinated or remembered name) is refused with a real ToolMessage instead of running.
 */
export function createPlanMiddleware(allows: (toolName: string) => boolean) {
  return createMiddleware({
    name: "PlanMode",
    wrapModelCall: (request, handler) =>
      handler({
        ...request,
        tools: request.tools.filter((t) => allows(String((t as { name?: string }).name))),
      }),
    wrapToolCall: async (request, handler) => {
      const { name, id } = request.toolCall;
      if (allows(name)) return handler(request);
      return new ToolMessage({ content: REFUSAL, tool_call_id: id ?? name, name, status: "error" });
    },
  });
}
