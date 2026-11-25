// The stored copy of a tool result keeps what the chat shows, not whole web pages.
// The model already read the full text; every chat open reads these rows back from
// Neon, and one scraped search plus one web_fetch made 185 KB of a 372 KB chat.
const cap = (text: string, max: number) =>
	text.length > max ? `${text.slice(0, max)}… (trimmed)` : text;

// Any other result (an MCP server's, an app's) is stored whole only up to this size;
// past it, a preview. One test server's 2 MB answer was otherwise one 2 MB row.
const MAX_STORED = 20_000;

export function withoutPageText(data: unknown): unknown {
	const slim = slimOutput(data);
	const output = (slim as { output?: unknown } | null)?.output;
	if (output === undefined) return slim;
	const json = JSON.stringify(output) ?? "";
	return json.length > MAX_STORED
		? {
				...(slim as object),
				output: { trimmed: true, preview: `${json.slice(0, 2000)}…` },
			}
		: slim;
}

function slimOutput(data: unknown): unknown {
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
	// computer_* tools: command output (the model already read up to 12 KB of it).
	if (typeof slim.stdout === "string") slim.stdout = cap(slim.stdout, 2000);
	if (typeof slim.stderr === "string") slim.stderr = cap(slim.stderr, 1000);
	return { ...(data as object), output: slim };
}
