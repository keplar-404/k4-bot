import { afterEach, expect, mock, test } from "bun:test";
import { ensureToolkit, mcpUrlError, pickedMcp } from "./mcp";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

test("picked servers: only valid names, no repeats, capped", () => {
	expect(pickedMcp(["docs", "docs", "x", "Bad", "../a", 3, null])).toEqual([
		"docs",
	]);
	expect(pickedMcp("docs")).toEqual([]);
	expect(pickedMcp(undefined)).toEqual([]);
	expect(pickedMcp(Array.from({ length: 50 }, (_, i) => `s${i}`)).length).toBe(
		20,
	);
});

test("only public https URLs without keys in them", () => {
	expect(mcpUrlError("https://mcp.notion.com/mcp")).toBeNull();
	expect(mcpUrlError("http://mcp.notion.com/mcp")).toContain("https");
	expect(mcpUrlError("not a url")).toContain("isn't a URL");
	expect(mcpUrlError("https://user:pw@x.com/mcp")).toContain("key");
	expect(mcpUrlError("https://x.com/mcp?api_key=1")).toContain("key");
	expect(mcpUrlError("https://localhost/mcp")).toContain("public");
	expect(mcpUrlError("https://10.0.0.1/mcp")).toContain("public");
});

/** Fakes Composio's API: each call gets the next answer; returns what was sent. */
function fakeComposio(...answers: [number, unknown][]) {
	const sent: { url: string; body?: unknown }[] = [];
	globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
		sent.push({
			url: String(url),
			body: init?.body ? JSON.parse(String(init.body)) : undefined,
		});
		const [status, body] = answers.shift() ?? [500, null];
		return Response.json(body, { status });
	}) as unknown as typeof fetch;
	return sent;
}

test("a shared toolkit is made with the chosen auth; keys stay on Composio", async () => {
	const sent = fakeComposio([200, { slug: "CUSTOM_ACME" }]);
	expect(
		await ensureToolkit({
			name: "acme",
			url: "https://mcp.acme.com/mcp",
			auth: "key",
			header: "x-api-key",
		}),
	).toEqual({ slug: "CUSTOM_ACME", auth: "key" });
	expect(sent[0].body).toMatchObject({
		user_id: "all",
		mcp_url: "https://mcp.acme.com/mcp",
		auth_schemes: [
			{ mode: "API_KEY", headers: { "x-api-key": "{{generic_api_key}}" } },
		],
	});
	const oauth = fakeComposio([200, { slug: "CUSTOM_NOTION" }]);
	await ensureToolkit({
		name: "notion",
		url: "https://mcp.notion.com/mcp",
		auth: "oauth",
	});
	expect(oauth[0].body).toMatchObject({
		auth_schemes: [
			{
				mode: "DCR_OAUTH",
				discovery_url:
					"https://mcp.notion.com/.well-known/oauth-authorization-server",
			},
		],
	});
});

test("a URL another user added reuses its toolkit and its auth", async () => {
	fakeComposio(
		[409, { error: { message: "already shared" } }],
		[
			200,
			{
				items: [
					{
						slug: "custom_notion",
						auth_schemes: ["DCR_OAUTH"],
						meta: { app_url: "https://mcp.notion.com/mcp" },
					},
				],
			},
		],
	);
	expect(
		await ensureToolkit({
			name: "n",
			url: "https://mcp.notion.com/mcp",
			auth: "none",
		}),
	).toEqual({ slug: "CUSTOM_NOTION", auth: "oauth" });
	const refused = fakeComposio(
		[400, { error: { message: "mcp_url must be reachable" } }],
		[
			200,
			{ items: [{ slug: "custom_x", meta: { app_url: "https://x.com/mcp" } }] },
		],
		[200, {}],
	);
	await expect(
		ensureToolkit({ name: "x", url: "https://x.com/mcp", auth: "none" }),
	).rejects.toThrow("mcp_url must be reachable");
	// The toolkit Composio kept anyway is deleted.
	expect(refused[2].url).toEndWith("/custom/toolkits/CUSTOM_X");
});
