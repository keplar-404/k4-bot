import { z } from "zod";
import { tool } from "langchain";
import { TavilySearch } from "@langchain/tavily";

export type AgentTool = ReturnType<typeof createInternetSearchTool>;

/** Results go straight into the model's context, so the count is capped. */
const MAX_RESULTS = 10;

/**
 * Web search for the deep agent (Tavily). The key is injected by the caller from
 * the validated env, never read from module scope.
 *
 * Tavily reports failures (bad key, bad query) as a normal `{ error }` payload.
 * That is turned into a thrown error so the agent sees a failed tool call, can
 * react to it, and the audit log records it as a failure.
 */
export function createInternetSearchTool(tavilyApiKey: string) {
  return tool(
    async ({ query, maxResults, topic }) => {
      const result = await new TavilySearch({ tavilyApiKey, maxResults, topic })._call({ query });
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(`Web search failed: ${String(result.error)}`);
      }
      return result;
    },
    {
      name: "internet_search",
      description:
        "Search the web for current information and return ranked results with a title, URL and " +
        "content snippet. Use topic 'news' for recent events and 'finance' for markets. " +
        "Cite the URLs you rely on.",
      schema: z.object({
        query: z.string().min(1).describe("The search query"),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(MAX_RESULTS)
          .default(5)
          .describe(`Number of results to return (1-${MAX_RESULTS})`),
        topic: z
          .enum(["general", "news", "finance"])
          .default("general")
          .describe("Search category"),
      }),
    },
  );
}
