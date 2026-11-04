import { z } from "zod";

/**
 * The web tools' arguments: Tavily's documented parameters and limits, tightened where a value multiplies the bill
 * (crawl limit and depth, map limit). The model cannot ask for more than these.
 */
const domains = z.array(z.string().min(3).max(200)).max(50);
const paths = z.array(z.string().max(200)).max(20);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const searchSchema = z.object({
  query: z.string().min(2).max(400),
  search_depth: z.enum(["advanced", "basic", "fast", "ultra-fast"]).default("advanced"),
  topic: z.enum(["general", "news", "finance"]).default("general").describe("'news' for current events, 'finance' for markets."),
  max_results: z.number().int().min(1).max(20).default(10),
  chunks_per_source: z.number().int().min(1).max(3).optional().describe("Passages per result (advanced/basic/fast). Default 3."),
  time_range: z.enum(["day", "week", "month", "year"]).optional(),
  start_date: date.optional().describe("Only results published after this date."),
  end_date: date.optional().describe("Only results published before this date."),
  filter_by_published_date: z.boolean().optional().describe("Drop results outside the dates or without a known date."),
  max_age_hours: z.number().int().min(0).max(720).optional().describe("0 = always fetch live (breaking news); N = a cached copy at most N hours old."),
  include_answer: z.enum(["basic", "advanced"]).optional().describe("Also get Tavily's short generated answer. A summary to check, never a source."),
  include_raw_content: z.enum(["markdown", "text"]).optional().describe("Full page text of each result. Costly in context: prefer tavily_extract on the few pages you need."),
  include_images: z.boolean().optional().describe("Image URLs for the query and each result."),
  include_image_descriptions: z.boolean().optional().describe("With include_images: a description of each image."),
  include_domains: domains.optional().describe('Only these sites, e.g. ["sec.gov", "*.gov"]. Social media: ["reddit.com", "x.com", "linkedin.com"].'),
  include_domains_mode: z.enum(["restrict", "prefer"]).optional().describe("'prefer' ranks include_domains first instead of filtering. Default restrict."),
  exclude_domains: domains.optional(),
  country: z.string().max(40).optional().describe('Boost one country, e.g. "united states" (general topic only).'),
  language: z.string().max(20).optional().describe('ISO 639-1 code or name, e.g. "en", "zh-cn", "french". Boosts that language.'),
  filter_by_language: z.boolean().optional().describe("With language: drop results in other languages."),
  exact_match: z.boolean().optional().describe('Only results containing the "quoted phrases" of the query.'),
  safe_search: z.boolean().optional().describe("Filter adult content (not with fast/ultra-fast)."),
});

export const extractSchema = z.object({
  urls: z.array(z.url()).min(1).max(20),
  extract_depth: z.enum(["basic", "advanced"]).default("advanced"),
  query: z.string().max(400).optional().describe("Return only the passages about this."),
  chunks_per_source: z.number().int().min(1).max(5).optional().describe("Passages per page when query is set."),
  include_images: z.boolean().optional().describe("Also list each page's image URLs."),
});

const site = {
  url: z.url(),
  max_depth: z.number().int().min(1).max(3).default(1),
  max_breadth: z.number().int().min(1).max(100).default(20),
  select_paths: paths.optional().describe('Regex paths to keep, e.g. ["/docs/.*"].'),
  exclude_paths: paths.optional(),
  select_domains: paths.optional().describe('Regex domains to stay on, e.g. ["^docs\\\\.example\\\\.com$"].'),
  exclude_domains: paths.optional(),
  allow_external: z.boolean().default(false).describe("Include links to other sites in the results."),
};

export const mapSchema = z.object({
  ...site,
  instructions: z.string().max(400).optional().describe("Focus, e.g. 'pricing and plans pages' (doubles the cost)."),
  limit: z.number().int().min(1).max(200).default(50),
});

export const crawlSchema = z.object({
  ...site,
  instructions: z.string().min(3).max(400).describe("What to collect, e.g. 'API rate limits and quotas'."),
  chunks_per_source: z.number().int().min(1).max(5).default(3),
  limit: z.number().int().min(1).max(30).default(20),
  extract_depth: z.enum(["basic", "advanced"]).default("basic"),
  include_images: z.boolean().optional(),
});

export const researchSchema = z.object({
  input: z.string().min(10).max(4_000).describe("The research task: the user's question with every detail and limit they gave."),
  model: z.enum(["mini", "pro", "auto"]).default("auto").describe("mini: narrow, well-scoped questions. pro: broad, multi-domain topics. auto: unsure."),
  citation_format: z.enum(["numbered", "mla", "apa", "chicago"]).default("numbered"),
  output_length: z.enum(["short", "standard", "long"]).default("standard"),
  include_domains: z.array(z.string().max(200)).max(20).optional(),
  exclude_domains: z.array(z.string().max(200)).max(20).optional(),
});
