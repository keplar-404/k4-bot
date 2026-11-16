// What the agent's web_search tool returns. The tool produces it and the web chat renders
// it, so a change here is a type error on both sides instead of a blank tool row.

export type SearchOutput = {
	query: string;
	results: { url: string; title: string; snippet: string; markdown?: string }[];
};
