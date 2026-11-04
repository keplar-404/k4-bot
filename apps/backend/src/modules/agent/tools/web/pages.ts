import { call, clip, compact } from "./client";
import { billedCredits, crawlCost, extractCost } from "./costs";
import type { Billed } from "./guard";

/** POST /extract, /map and /crawl (https://docs.tavily.com/documentation/api-reference). */

export interface ExtractParams {
  urls: string[];
  extract_depth?: "basic" | "advanced";
  query?: string;
  chunks_per_source?: number;
  include_images?: boolean;
}

export interface MapParams {
  url: string;
  instructions?: string;
  max_depth?: number;
  max_breadth?: number;
  limit?: number;
  select_paths?: string[];
  select_domains?: string[];
  exclude_paths?: string[];
  exclude_domains?: string[];
  allow_external?: boolean;
}

export interface CrawlParams extends MapParams {
  extract_depth?: "basic" | "advanced";
  chunks_per_source?: number;
  include_images?: boolean;
}

type Page = { url: string; raw_content?: string | null; images?: string[] };
type PagesResponse = { results?: Page[]; failed_results?: Array<{ url: string; error: string }>; usage?: { credits?: number } };

/** Per page and per call caps keep one call from flooding the context (long results are offloaded to files anyway). */
function pagesText(pages: Page[], perPage: number, total: number) {
  let budget = total;
  return pages.map((r) => {
    const text = clip(r.raw_content ?? "", Math.min(perPage, Math.max(1_000, budget)));
    budget -= text.length;
    const images = r.images?.length ? `\nImages: ${r.images.slice(0, 10).join(" ")}` : "";
    return `## ${r.url}\n${text}${images}`;
  });
}

export async function extract(apiKey: string, params: ExtractParams): Promise<Billed> {
  const data = await call<PagesResponse>(apiKey, "/extract", compact({ ...params, format: "markdown", timeout: 45, include_usage: true }), 60_000);
  const pages = pagesText(data.results ?? [], 20_000, 60_000);
  const failed = data.failed_results?.length
    ? `\n\nCould not read: ${data.failed_results.map((f) => `${f.url} (${f.error})`).join("; ")}. Retry once with extract_depth "advanced"; if it still fails the page blocks automated readers: open it in the computer's browser if you have one.`
    : "";
  const read = (data.results ?? []).map((r) => r.url);
  // Failed URLs are free; successful ones are never recorded as free (see billedCredits).
  const credits = read.length ? billedCredits(data.usage?.credits, extractCost({ urls: read, extract_depth: params.extract_depth })) : 0;
  return { text: (pages.join("\n\n") || "No content extracted.") + failed, credits };
}

export async function map(apiKey: string, params: MapParams): Promise<Billed> {
  const data = await call<{ results?: string[]; usage?: { credits?: number } }>(apiKey, "/map", compact({ ...params, timeout: 90, include_usage: true }), 100_000);
  const urls = data.results ?? [];
  return { text: urls.length ? `${urls.length} URLs found:\n${urls.join("\n")}` : "No URLs found.", credits: data.usage?.credits };
}

export async function crawl(apiKey: string, params: CrawlParams): Promise<Billed> {
  const data = await call<PagesResponse>(apiKey, "/crawl", compact({ ...params, format: "markdown", timeout: 120, include_usage: true }), 150_000);
  const pages = pagesText(data.results ?? [], 8_000, 60_000);
  return {
    text: pages.length ? `${pages.length} pages:\n\n${pages.join("\n\n")}` : "The crawl returned no pages. Try a smaller depth or other paths.",
    credits: billedCredits(data.usage?.credits, pages.length ? crawlCost({ ...params, limit: pages.length }) : 0),
  };
}
