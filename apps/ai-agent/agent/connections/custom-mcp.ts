// The user's own MCP servers (Settings > Connectors), for apps Composio doesn't have.
// One connection per server, named mcp-<name>. The memo keeps names and URLs only;
// the key is read and decrypted per connection attempt (mcpKey), never memoized or
// shown to the model. eve docs: connections > Dynamic connections, Per-caller headers.
import { connectionName, listMcp, mcpKey } from "@repo/shared/mcp";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import { appUserId, db } from "../lib/db";
import { modeOf } from "../lib/mode";

export default defineDynamic(async (ctx) => {
	const userId = appUserId(ctx.session.auth.current);
	if (!userId || !ctx.turn || modeOf(ctx.session) === "plan") return null;
	// Per turn, so a server added or deleted mid-chat counts from the next message.
	const servers = await ctx.memo(`mcp:${ctx.turn.id}`, () =>
		listMcp(db(), userId),
	);
	if (!servers.length) return null;
	return Object.fromEntries(
		servers.map((s) => [
			connectionName(s.name),
			defineMcpClientConnection({
				url: s.url,
				description: s.description,
				instanceKey: `${userId}:${s.name}`,
				...(s.header ? { headers: () => mcpKey(db(), userId, s.name) } : {}),
				// The server is the user's choice, not ours: in Ask mode, confirm anything
				// the server doesn't mark read-only. Full asks nothing; Plan hides it above.
				approval: ({ session, toolAnnotations }) =>
					modeOf(session) === "ask" && toolAnnotations?.readOnlyHint !== true
						? "user-approval"
						: "not-applicable",
			}),
		]),
	);
});
