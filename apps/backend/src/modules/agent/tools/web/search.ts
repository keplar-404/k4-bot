import { call, clip, compact } from "./client";

/** POST /search, as in https://docs.tavily.com/documentation/api-reference/endpoint/search. */
export interface SearchParams {
  query: string;
  search_depth?: "basic" | "advanced" | "fast" | "ultra-fast";
  auto_parameters?: boolean;
  topic?: "general" | "news" | "finance";
  max_results?: number;
  chunks_per_source?: number;
  time_range?: "day" | "week" | "month" | "year";
  start_date?: string;
  end_date?: string;
  filter_by_published_date?: boolean;
  max_age_hours?: number;
  include_answer?: boolean | "basic" | "advanced";
  include_raw_content?: boolean | "markdown" | "text";
  include_images?: boolean;
  include_image_descriptions?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
  include_domains_mode?: "restrict" | "prefer";
  country?: string;
  language?: string;
  filter_by_language?: boolean;
  exact_match?: boolean;
  safe_search?: boolean;
}

type Result = { title: string; url: string; content: string; score: number; published_date?: string | null; raw_content?: string | null };
type Image = string | { url: string; description?: string };
type SearchResponse = { answer?: string; images?: Image[]; results: Result[] };

/** Raw page text per result and overall, when the model asked for it (results are offloaded to files when long). */
const RAW_PER_RESULT = 6_000;
const RAW_TOTAL = 40_000;

const imageLine = (i: Image) => (typeof i === "string" ? `- ${i}` : `- ${i.url}${i.description ? ` — ${i.description}` : ""}`);

export async function search(apiKey: string, params: SearchParams): Promise<string> {
  // include_domains_mode without include_domains is a 400 at Tavily.
  const body = compact({ ...params, include_domains_mode: params.include_domains?.length ? params.include_domains_mode : undefined });
  const data = await call<SearchResponse>(apiKey, "/search", body, 30_000);
  if (!data.results?.length && !data.answer) return `No results for "${params.query}". Try other words, or remove filters.`;

  let raw = RAW_TOTAL;
  const results = data.results.map((r, i) => {
    const head = `[${i + 1}] ${r.title}\n${r.url}${r.published_date ? ` (published ${r.published_date})` : ""} · relevance ${r.score.toFixed(2)}\n${r.content}`;
    if (!r.raw_content || raw <= 0) return head;
    const page = clip(r.raw_content, Math.min(RAW_PER_RESULT, raw));
    raw -= page.length;
    return `${head}\n--- page text ---\n${page}`;
  });
  const parts = [
    data.answer ? `Tavily's generated answer (a summary to check against the sources, not a source):\n${data.answer}` : "",
    results.join("\n\n"),
    data.images?.length ? `Images:\n${data.images.map(imageLine).join("\n")}` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}
