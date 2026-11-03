import { createMiddleware } from "langchain";
import { MAX_PARALLEL_TOOLS } from "../domains/types";

/**
 * Runs at most `limit` tool calls at the same time. LangChain already runs every tool call of one model step in
 * parallel (ToolNode: Promise.all); this queues the rest, so a step with 15 searches runs 10, then 5.
 *
 * Note: a Worker keeps at most 6 outgoing connections open at once, so beyond 6 the network calls themselves queue
 * in the runtime. The limit still matters for tools that are not network bound and for cost control.
 */
export function createParallelToolsMiddleware(limit: number) {
  const max = Math.min(Math.max(1, Math.floor(limit)), MAX_PARALLEL_TOOLS);
  let running = 0;
  const waiting: Array<() => void> = [];
  const acquire = () =>
    running < max
      ? (running++, Promise.resolve())
      : new Promise<void>((resolve) => waiting.push(() => (running++, resolve())));
  const release = () => {
    running--;
    waiting.shift()?.();
  };

  return createMiddleware({
    name: "ParallelToolsMiddleware",
    wrapToolCall: async (request, handler) => {
      await acquire();
      try {
        return await handler(request);
      } finally {
        release();
      }
    },
  });
}
