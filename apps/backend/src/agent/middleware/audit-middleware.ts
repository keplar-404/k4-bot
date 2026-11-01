import { createMiddleware } from "langchain";

export type AgentEvent = {
  kind: "tool_call" | "tool_result";
  name: string;
  input?: unknown;
  error?: string;
};

export type AgentEventEmitter = (event: AgentEvent) => void | Promise<void>;

/** Emits every tool call and result so the run can stream them to the client. */
export function createAuditMiddleware(emit: AgentEventEmitter) {
  return createMiddleware({
    name: "AuditMiddleware",
    wrapToolCall: async (request, handler) => {
      const name = request.toolCall.name;
      await emit({ kind: "tool_call", name, input: request.toolCall.args });
      try {
        const result = await handler(request);
        await emit({ kind: "tool_result", name });
        return result;
      } catch (error) {
        await emit({
          kind: "tool_result",
          name,
          error: error instanceof Error ? error.message : "tool execution failed",
        });
        throw error;
      }
    },
  });
}
