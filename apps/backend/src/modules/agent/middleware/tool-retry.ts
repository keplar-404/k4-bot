import { toolRetryMiddleware } from "langchain";
import { isTransient } from "../../chat/run/provider-error";

/**
 * Tools that only read, so trying again after a network hiccup cannot repeat an effect. Computer actions, sandbox
 * commands, file writes and app writes are never retried: a second click, command or write would happen twice.
 */
export const RETRY_SAFE_TOOLS = ["tavily_search", "tavily_extract", "tavily_map", "tavily_crawl", "read_document"];

/** LangChain's tool retry, limited to read-only tools (plus connected apps' read-only tools) and transient errors. */
export function createToolRetryMiddleware(appReadOnly: string[] = [], maxRetries = 2) {
  return toolRetryMiddleware({
    tools: [...RETRY_SAFE_TOOLS, ...appReadOnly],
    maxRetries,
    // A longer series (the workflow assistant retries 10 times) must not wait minutes: each wait is capped.
    backoffFactor: 1.6,
    maxDelayMs: 15_000,
    retryOn: (error: Error) => isTransient(error),
    onFailure: "continue",
  });
}
