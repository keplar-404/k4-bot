import { expect, test } from "bun:test";
import { withoutPageText } from "../agent/lib/page-text";

test("stored web_search results drop page markdown and cap snippets", () => {
	const data = {
		callId: "c1",
		output: {
			query: "q",
			results: [
				{ url: "u", title: "t", snippet: "s", markdown: "x".repeat(8000) },
				{ url: "v", title: "t", snippet: "y".repeat(5000) },
			],
		},
	};
	const out = withoutPageText(data) as typeof data;
	expect(out.callId).toBe("c1");
	expect(out.output.results[0]).toEqual({ url: "u", title: "t", snippet: "s" });
	expect(out.output.results[1].snippet.length).toBeLessThan(520);
});

test("stored web_fetch content is capped; other data is unchanged", () => {
	const out = withoutPageText({
		output: { url: "u", content: "z".repeat(50_000) },
	}) as { output: { url: string; content: string } };
	expect(out.output.url).toBe("u");
	expect(out.output.content.length).toBeLessThan(2020);
	expect(withoutPageText({ text: "hi" })).toEqual({ text: "hi" });
	expect(withoutPageText(null)).toBeNull();
	expect(withoutPageText({ output: "plain" })).toEqual({ output: "plain" });
});
