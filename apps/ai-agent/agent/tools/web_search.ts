import { defineTool } from "eve/tools";
import { z } from "zod";

// Replaces eve's built-in web_search with Firecrawl /search.
// Per docs.firecrawl.dev/agent-source-of-truth/node: client.search(query, { limit, tbs, scrapeOptions }).
export default defineTool({
	description:
		"Search the web for current information. Returns ranked results with url, title and snippet. Set `scrape` to also get each page's main content as markdown (slower, use when snippets are not enough).",
	inputSchema: z.object({
		query: z
			.string()
			.min(1)
			.describe("Search query. Supports operators like site:, quotes, -term."),
		limit: z.number().int().min(1).max(10).default(5),
		recency: z
			.enum(["any", "day", "week", "month", "year"])
			.default("any")
			.describe("Only results from the past day/week/month/year."),
		scrape: z.boolean().default(false),
	}),
	label: { start: ({ query }) => `Search the web for “${query}”` },
	async execute({ query, limit, recency, scrape }) {
		const { Firecrawl } = await import("firecrawl");
		const client = new Firecrawl({
			apiKey: process.env.FIRECRAWL_API_KEY || undefined,
		});
		const tbs = {
			any: undefined,
			day: "qdr:d",
			week: "qdr:w",
			month: "qdr:m",
			year: "qdr:y",
		}[recency];
		const data = await client.search(query, {
			limit,
			tbs,
			...(scrape
				? { scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }
				: {}),
		});
		return {
			query,
			results: (data.web ?? []).map((r) => {
				// Plain results have url/title/description; scraped ones are Documents.
				const doc = r as {
					url?: string;
					title?: string;
					description?: string;
					markdown?: string;
					metadata?: {
						title?: string;
						sourceURL?: string;
						url?: string;
						description?: string;
					};
				};
				return {
					url: doc.url ?? doc.metadata?.sourceURL ?? doc.metadata?.url ?? "",
					title: doc.title ?? doc.metadata?.title ?? "",
					snippet: doc.description ?? doc.metadata?.description ?? "",
					// ponytail: hard 8k cap per page keeps the context small; raise if answers miss detail.
					...(doc.markdown ? { markdown: doc.markdown.slice(0, 8000) } : {}),
				};
			}),
		};
	},
});
