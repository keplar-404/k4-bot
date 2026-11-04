import { call, clip, compact } from "./client";

export { TavilyError } from "./client";

/** Tavily's four endpoints, each formatted as compact text for the model. */

export interface SearchParams {
  query: string;
  search_depth?: "basic" | "advanced" | "fast" | "ultra-fast";
  topic?: "general" | "news" | "finance";
  max_results?: number;
  time_range?: "day" | "week" | "month" | "year";
  start_date?: string;
  end_date?: string;
  include_domains?: string[];
  exclude_domains?: string[];
  country?: string;
  chunks_per_source?: number;
}

type SearchResponse = { results: Array<{ title: string; url: string; content: string; score: number; published_date?: string }> };

export async function search(apiKey: string, params: SearchParams): Promise<string> {
  const data = await call<SearchResponse>(apiKey, "/search", compact({ ...params }), 30_000);
  if (!data.results?.length) return `No results for "${params.query}". Try other words, or remove filters.`;
  return data.results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}${r.published_date ? ` (published ${r.published_date})` : ""} · relevance ${r.score.toFixed(2)}\n${r.content}`)
    .join("\n\n");
}

export interface ExtractParams {
  urls: string[];
  extract_depth?: "basic" | "advanced";
  query?: string;
  chunks_per_source?: number;
}

type ExtractResponse = { results: Array<{ url: string; raw_content: string }>; failed_results?: Array<{ url: string; error: string }> };

/** Per page and per call caps keep one extract from flooding the context (long results are offloaded to files anyway). */
const MAX_PAGE_CHARS = 20_000;
const MAX_EXTRACT_CHARS = 60_000;

export async function extract(apiKey: string, params: ExtractParams): Promise<string> {
  const data = await call<ExtractResponse>(apiKey, "/extract", compact({ ...params, format: "markdown", timeout: 45 }), 60_000);
  let budget = MAX_EXTRACT_CHARS;
  const pages = data.results.map((r) => {
    const text = clip(r.raw_content ?? "", Math.min(MAX_PAGE_CHARS, Math.max(2_000, budget)));
    budget -= text.length;
    return `## ${r.url}\n${text}`;
  });
  const failed = data.failed_results?.length
    ? `\n\nCould not read: ${data.failed_results.map((f) => `${f.url} (${f.error})`).join("; ")}. These pages may block automated readers; if the computer is available, open them in its browser.`
    : "";
  return (pages.join("\n\n") || "No content extracted.") + failed;
}

export interface MapParams {
  url: string;
  instructions?: string;
  max_depth?: number;
  max_breadth?: number;
  limit?: number;
  select_paths?: string[];
  exclude_paths?: string[];
}

export async function map(apiKey: string, params: MapParams): Promise<string> {
  const data = await call<{ results: string[] }>(apiKey, "/map", compact({ ...params }), 90_000);
  return data.results?.length ? `${data.results.length} URLs found:\n${data.results.join("\n")}` : "No URLs found.";
}

export interface CrawlParams extends MapParams {
  extract_depth?: "basic" | "advanced";
  chunks_per_source?: number;
}

export async function crawl(apiKey: string, params: CrawlParams): Promise<string> {
  const data = await call<ExtractResponse>(apiKey, "/crawl", compact({ ...params, format: "markdown", timeout: 120 }), 150_000);
  let budget = MAX_EXTRACT_CHARS;
  const pages = (data.results ?? []).map((r) => {
    const text = clip(r.raw_content ?? "", Math.min(8_000, Math.max(1_000, budget)));
    budget -= text.length;
    return `## ${r.url}\n${text}`;
  });
  return pages.length ? `${pages.length} pages:\n\n${pages.join("\n\n")}` : "The crawl returned no pages. Try a smaller depth or other paths.";
}
