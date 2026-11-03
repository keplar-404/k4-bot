import { tool } from "langchain";
import { z } from "zod";
import { crawl, extract, map, search } from "./tavily";

/**
 * The bots' web tools, on Tavily. Named like Tavily's own MCP tools (tavily_search, tavily_extract, ...), so the
 * Tavily skills (tavily-ai/skills: tavily-search, tavily-research) work as written when a user installs them.
 *
 * "standard": search + extract (every bot). "advanced": also map + crawl, for whole sites (research bots).
 * Descriptions carry Tavily's own best practices (see .agents/skills/tavily-search): advanced depth, 10 results,
 * one focused query per part of the question, filters before more results, extract only what will be cited.
 */
export type WebLevel = "standard" | "advanced";

const domains = z.array(z.string().min(3).max(200)).max(50);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export function createWebTools(apiKey: string, level: WebLevel) {
  const searchTool = tool((args) => search(apiKey, args), {
    name: "tavily_search",
    description:
      "Search the web. Returns ranked results with title, URL, date and the passages that match the query. " +
      "Write a search-engine query (names and terms expected on the page, under 400 characters), one per part of the question; " +
      "run independent searches in the same step. Use search_depth 'advanced' and max_results 10 unless a quick lookup is enough. " +
      "Narrow with time_range/dates or include_domains (a hard filter: search again without it if it misses) rather than more results. " +
      "Snippets are leads: extract a page before citing a number, date or quote from it.",
    schema: z.object({
      query: z.string().min(2).max(400),
      search_depth: z.enum(["advanced", "basic", "fast", "ultra-fast"]).default("advanced"),
      topic: z.enum(["general", "news", "finance"]).default("general").describe("'news' for current events, 'finance' for markets."),
      max_results: z.number().int().min(1).max(20).default(10),
      time_range: z.enum(["day", "week", "month", "year"]).optional(),
      start_date: date.optional().describe("Only results published after this date."),
      end_date: date.optional().describe("Only results published before this date."),
      include_domains: domains.optional().describe('Only these sites, e.g. ["sec.gov", "*.gov"].'),
      exclude_domains: domains.optional(),
      country: z.string().max(40).optional().describe('Boost one country, e.g. "united states" (general topic only).'),
      chunks_per_source: z.number().int().min(1).max(5).optional().describe("Passages per result (advanced/fast depth). Default 3."),
    }),
  });

  const extractTool = tool((args) => extract(apiKey, args), {
    name: "tavily_extract",
    description:
      "Read web pages (up to 20 URLs per call) as markdown, including pages built with JavaScript. " +
      "Extract only the pages you expect to cite. Full pages by default; pass query (+ chunks_per_source) only to pull one fact from a long page. " +
      "If a page fails or comes back empty, retry it with extract_depth 'advanced'. Say which pages could not be read.",
    schema: z.object({
      urls: z.array(z.url()).min(1).max(20),
      extract_depth: z.enum(["basic", "advanced"]).default("basic"),
      query: z.string().max(400).optional().describe("Return only the passages about this."),
      chunks_per_source: z.number().int().min(1).max(5).optional().describe("Passages per page when query is set."),
    }),
  });

  if (level === "standard") return [searchTool, extractTool];

  const mapTool = tool((args) => map(apiKey, args), {
    name: "tavily_map",
    description:
      "List the URLs of a website (no content), to find the right page on a site before extracting it, or to plan a crawl. " +
      "Use instructions to focus it (e.g. 'pricing and plans pages').",
    schema: z.object({
      url: z.url(),
      instructions: z.string().max(400).optional(),
      max_depth: z.number().int().min(1).max(3).default(1),
      max_breadth: z.number().int().min(1).max(100).default(20),
      limit: z.number().int().min(1).max(200).default(50),
      select_paths: z.array(z.string().max(200)).max(20).optional().describe('Regex paths to keep, e.g. ["/docs/.*"].'),
      exclude_paths: z.array(z.string().max(200)).max(20).optional(),
    }),
  });

  const crawlTool = tool((args) => crawl(apiKey, args), {
    name: "tavily_crawl",
    description:
      "Read many pages of one site section at once. Start small (max_depth 1, limit 20) and always give instructions with chunks_per_source " +
      "so only the relevant passages come back. Prefer tavily_map then tavily_extract when you only need a few pages.",
    schema: z.object({
      url: z.url(),
      instructions: z.string().min(3).max(400).describe("What to collect, e.g. 'API rate limits and quotas'."),
      chunks_per_source: z.number().int().min(1).max(5).default(3),
      max_depth: z.number().int().min(1).max(3).default(1),
      max_breadth: z.number().int().min(1).max(100).default(20),
      limit: z.number().int().min(1).max(30).default(20),
      select_paths: z.array(z.string().max(200)).max(20).optional(),
      exclude_paths: z.array(z.string().max(200)).max(20).optional(),
      extract_depth: z.enum(["basic", "advanced"]).default("basic"),
    }),
  });

  return [searchTool, extractTool, mapTool, crawlTool];
}
