// The stored copy of a tool result keeps what the chat shows, not whole web pages.
// The model already read the full text; every chat open reads these rows back from
// Neon, and one scraped search plus one web_fetch made 185 KB of a 372 KB chat.
const cap = (text: string, max: number) =>
	text.length > max ? `${text.slice(0, max)}… (trimmed)` : text;

export function withoutPageText(data: unknown): unknown {
	const output = (data as { output?: Record<string, unknown> } | null)?.output;
	if (!output || typeof output !== "object") return data;
	const slim = { ...output };
	// web_search: url/title/snippet only, no scraped markdown.
	if (Array.isArray(slim.results))
		slim.results = slim.results.map(({ markdown: _, ...r }) => ({
			...r,
			...(typeof r.snippet === "string"
				? { snippet: cap(r.snippet, 500) }
				: {}),
		}));
	// web_fetch and similar: page text in `content`.
	if (typeof slim.content === "string") slim.content = cap(slim.content, 2000);
	return { ...(data as object), output: slim };
}
