import { toolRetryMiddleware } from "langchain";
import { isTransient } from "../../chat/run/provider-error";

/**
 * Tools that only read, so trying again after a network hiccup cannot repeat an effect. Computer actions, sandbox
 * commands, file writes and app writes are never retried: a second click, command or write would happen twice.
 */
export const RETRY_SAFE_TOOLS = ["tavily_search", "tavily_extract", "tavily_map", "tavily_crawl", "read_document"];

/** LangChain's tool retry, limited to read-only tools (plus connected apps' read-only tools) and transient errors. */
export function createToolRetryMiddleware(appReadOnly: string[] = []) {
  return toolRetryMiddleware({
    tools: [...RETRY_SAFE_TOOLS, ...appReadOnly],
    maxRetries: 2,
    retryOn: (error: Error) => isTransient(error),
    onFailure: "continue",
  });
}
