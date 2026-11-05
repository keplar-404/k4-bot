import { tool } from "langchain";
import { crawl, extract, map } from "./pages";
import type { ResearchArchive } from "./research-archive";
import { runResearch } from "./research-run";
import { crawlSchema, extractSchema, mapSchema, researchSchema, searchSchema } from "./schemas";
import { search } from "./search";

export { TavilyError } from "./client";
export type { ResearchArchive } from "./research-archive";

/**
 * The bots' web tools, on Tavily. Named like Tavily's own MCP tools (tavily_search, tavily_extract, ...), so the
 * Tavily skills (tavily-ai/skills) work as written when a user installs them. Every bot gets all four.
 * `tavily_research` (Tavily's research agent) exists only in a run the user started with /deep-research; its task and
 * report are kept in `archive` (see research-run.ts), so a request is paid for once and its report outlives the context.
 */
export function createWebTools(o: { apiKey: string; research?: boolean; archive?: ResearchArchive }) {
  const { apiKey } = o;

  const searchTool = tool((args) => search(apiKey, args), {
    name: "tavily_search",
    description:
      "Search the web. Returns ranked results with title, URL, date and the passages that match the query; optionally a generated answer, images or full page text. " +
      "Write a search-engine query (names and terms expected on the page, under 400 characters), one per part of the question; " +
      "run independent searches in the same step. Use search_depth 'advanced' and max_results 10 unless a quick lookup is enough. " +
      "Narrow with time_range/dates or include_domains (a hard filter: search again without it if it misses) rather than more results. " +
      "Snippets are leads: extract a page before citing a number, date or quote from it.",
    schema: searchSchema,
  });

  const extractTool = tool((args) => extract(apiKey, args), {
    name: "tavily_extract",
    description:
      "Read web pages (up to 20 URLs per call) as markdown, including pages built with JavaScript, tables and embedded content. " +
      "Extract only the pages you expect to cite. Full pages by default; pass query (+ chunks_per_source) only to pull one fact from a long page. " +
      "Say which pages could not be read.",
    schema: extractSchema,
  });

  const mapTool = tool((args) => map(apiKey, args), {
    name: "tavily_map",
    description:
      "List the URLs of a website (no content), to find the right page on a site before extracting it, or to plan a crawl. " +
      "Use instructions to focus it (e.g. 'pricing and plans pages'). Cheaper than a crawl: map first, then extract the pages you need.",
    schema: mapSchema,
  });

  const crawlTool = tool((args) => crawl(apiKey, args), {
    name: "tavily_crawl",
    description:
      "Read many pages of one site section at once (the most expensive web tool). Start small (max_depth 1, limit 20) and always give instructions " +
      "so only the relevant passages come back. Prefer tavily_map then tavily_extract when you only need a few pages.",
    schema: crawlSchema,
  });

  const tools = [searchTool, extractTool, mapTool, crawlTool];
  if (!o.research) return tools;

  const researchTool = tool(
    (args, config) => runResearch(apiKey, args, { archive: o.archive, signal: config?.signal }),
    {
      name: "tavily_research",
      description:
        "Tavily's deep research agent: it plans, runs many searches, reads the sources and writes a cited report (takes 1-10 minutes). " +
        "Call it exactly once, with the user's whole question and every detail and limit they gave.",
      schema: researchSchema,
    },
  );
  return [...tools, researchTool];
}
