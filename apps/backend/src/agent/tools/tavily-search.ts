import { z } from "zod";
import { tool } from "langchain";
import { TavilySearch } from "@langchain/tavily";

export type AgentTool = ReturnType<typeof tool>;

/**
 * Web search tool for the deep agent. Tavily key is injected per-request from
 * the validated env, never from module scope.
 */
export function createInternetSearchTool(tavilyApiKey: string | undefined): AgentTool {
  return tool(
    async ({
      query,
      maxResults = 5,
      topic = "general",
      includeRawContent = false,
    }: {
      query: string;
      maxResults?: number;
      topic?: "general" | "news" | "finance";
      includeRawContent?: boolean;
    }) => {
      const tavilySearch = new TavilySearch({
        maxResults,
        tavilyApiKey,
        includeRawContent,
        topic,
      });
      return await tavilySearch._call({ query });
    },
    {
      name: "internet_search",
      description: "Run a web search and return results for a given query.",
      schema: z.object({
        query: z.string().describe("The search query"),
        maxResults: z
          .number()
          .optional()
          .default(5)
          .describe("Maximum number of results to return"),
        topic: z
          .enum(["general", "news", "finance"])
          .optional()
          .default("general")
          .describe("Search topic category"),
        includeRawContent: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to include raw page content"),
      }),
    },
  ) as any;
}
