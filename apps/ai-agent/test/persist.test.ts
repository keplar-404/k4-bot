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

test("any huge stored result (an MCP server's) becomes a short preview", () => {
	const big = withoutPageText({
		callId: "c2",
		output: { content: [{ type: "text", text: "Z".repeat(2_000_000) }] },
	}) as { callId: string; output: { trimmed: boolean; preview: string } };
	expect(big.callId).toBe("c2");
	expect(big.output.trimmed).toBe(true);
	expect(JSON.stringify(big).length).toBeLessThan(2200);
	const text = withoutPageText({ output: "Y".repeat(100_000) }) as {
		output: { preview: string };
	};
	expect(text.output.preview.length).toBeLessThan(2010);
	const small = { output: { content: [{ type: "text", text: "ok" }] } };
	expect(withoutPageText(small)).toEqual(small);
});

test("stored computer tool output is capped; exit code is kept", () => {
	const out = withoutPageText({
		output: {
			exitCode: 0,
			stdout: "o".repeat(12_000),
			stderr: "e".repeat(4_000),
		},
	}) as { output: { exitCode: number; stdout: string; stderr: string } };
	expect(out.output.exitCode).toBe(0);
	expect(out.output.stdout.length).toBeLessThan(2020);
	expect(out.output.stderr.length).toBeLessThan(1020);
});
