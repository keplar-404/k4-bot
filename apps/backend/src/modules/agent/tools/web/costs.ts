/**
 * The most a Tavily call can cost, in credits, from https://docs.tavily.com/documentation/api-credits. The guard
 * reserves this before the call and refunds the difference once the response's `usage.credits` says what it cost.
 */

const per = (count: number, size: number) => Math.ceil(Math.max(1, count) / size);

/** basic, fast, ultra-fast: 1. advanced: 2. auto_parameters: 2 (it may also switch to advanced). */
export function searchCost(p: { search_depth?: string; auto_parameters?: boolean }): number {
  return p.search_depth === "advanced" || p.auto_parameters ? 2 : 1;
}

/** 1 credit per 5 successful URLs (basic), 2 per 5 (advanced). Failed URLs are free. */
export function extractCost(p: { urls: string[]; extract_depth?: string }): number {
  return per(p.urls.length, 5) * (p.extract_depth === "advanced" ? 2 : 1);
}

/** 1 credit per 10 pages mapped, 2 per 10 with instructions. `limit` caps the pages (Tavily's default is 50). */
export function mapCost(p: { limit?: number; instructions?: string }): number {
  return per(p.limit ?? 50, 10) * (p.instructions ? 2 : 1);
}

/** Crawl = mapping cost + extraction cost for every page it may return. */
export function crawlCost(p: { limit?: number; instructions?: string; extract_depth?: string }): number {
  const pages = p.limit ?? 50;
  return mapCost(p) + extractCost({ urls: new Array(pages).fill(""), extract_depth: p.extract_depth });
}

/**
 * What to record for a finished call. Tavily reports extraction usage in batches ("may be 0 until total successful
 * extractions reach 5"), so a reported 0 is replaced by the documented cost of what actually came back.
 */
export const billedCredits = (reported: number | undefined, documented: number) => (reported && reported > 0 ? reported : documented);

/** Dynamic pricing with per-request bounds: mini 4–110, pro 15–250; auto may pick pro. */
export function researchCost(p: { model?: string }): number {
  return p.model === "mini" ? 110 : 250;
}
