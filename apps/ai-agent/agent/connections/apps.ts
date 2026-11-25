// The signed-in user's connected apps through Composio Platform (the Composio user is
// the Neon Auth user id). eve docs: connections > Dynamic connections. Composio docs:
// sessions-via-mcp, configuring-sessions (sandbox off: this agent runs no code).
import { hiddenCustom } from "@repo/shared/mcp";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import { appUserId, db } from "../lib/db";
import { modeOf } from "../lib/mode";

export default defineDynamic(async (ctx) => {
	const userId = appUserId(ctx.session.auth.current);
	if (!userId || modeOf(ctx.session) === "plan") return null;
	// Custom MCP toolkits other users added (shared on Composio's free plan; @repo/shared/
	// mcp): left out of this user's session. Read once a turn, so a new one counts at once.
	const hidden = ctx.turn
		? await ctx.memo(`hidden:${ctx.turn.id}`, () => hiddenCustom(db(), userId))
		: [];
	// One Composio session per chat (and per hidden list); the memo keeps only its URL,
	// never the key.
	const { url } = await ctx.memo(`${userId}:${hidden.join(",")}`, async () => {
		const { Composio } = await import("@composio/core");
		const session = await new Composio().create(userId, {
			mcp: true,
			sandbox: { enable: false },
			...(hidden.length ? { toolkits: { disable: hidden } } : {}),
		});
		return { url: session.mcp.url };
	});
	return defineMcpClientConnection({
		url,
		description:
			"The user's own apps (Gmail, Calendar, Slack, Notion, GitHub, Airtable, Sheets and 1,000+ more) and the MCP servers they added in Settings (toolkits named CUSTOM_…): search for actions and run them.",
		instanceKey: userId,
		// Connecting goes through the connect_app tool, which waits for the user.
		tools: { block: ["COMPOSIO_MANAGE_CONNECTIONS"] },
		headers: { "x-api-key": process.env.COMPOSIO_API_KEY ?? "" },
	});
});
