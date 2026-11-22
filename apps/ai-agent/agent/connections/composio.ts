// The signed-in user's connected apps through Composio Platform (the Composio user is
// the Neon Auth user id). eve docs: connections > Dynamic connections. Composio docs:
// sessions-via-mcp, configuring-sessions (sandbox off: this agent runs no code).
import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import { appUserId } from "../lib/db";
import { modeOf } from "../lib/mode";

export default defineDynamic(async (ctx) => {
	const userId = appUserId(ctx.session.auth.current);
	if (!userId || modeOf(ctx.session) === "plan") return null;
	// One Composio session per chat; the memo keeps only its URL, never the key.
	const { url } = await ctx.memo(userId, async () => {
		const { Composio } = await import("@composio/core");
		const session = await new Composio().create(userId, {
			mcp: true,
			sandbox: { enable: false },
		});
		return { url: session.mcp.url };
	});
	return defineMcpClientConnection({
		url,
		description:
			"The user's own apps through Composio (Gmail, Calendar, Slack, Notion, GitHub, Airtable, Sheets and 1,000+ more): search for tools, connect an app, and run its actions.",
		instanceKey: userId,
		// Connecting goes through the connect_app tool, which waits for the user.
		tools: { block: ["COMPOSIO_MANAGE_CONNECTIONS"] },
		headers: { "x-api-key": process.env.COMPOSIO_API_KEY ?? "" },
	});
});
