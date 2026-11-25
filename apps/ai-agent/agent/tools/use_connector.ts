// Runs one tool of the user's own MCP server (Settings > Custom connectors) through
// Composio, by the connector's name: no tool search. instructions/mcp.ts lists the
// picked connectors' tools and inputs. Only the signed-in user's own connectors.
import { listMcp, toolkitTools } from "@repo/shared/mcp";
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { appUserId, db } from "../lib/db";
import { notInPlan } from "../lib/mode";

const tool = defineTool({
	description:
		"Use one of the user's custom connectors (their own MCP servers, by name). Without `tool`: lists that connector's tools and their inputs. With `tool` (a slug from that list) and its `arguments`: runs it.",
	inputSchema: z.object({
		connector: z.string().min(1).max(30),
		tool: z.string().min(1).max(200).optional(),
		arguments: z.record(z.string(), z.unknown()).default({}),
	}),
	label: {
		start: ({ connector, tool }) =>
			tool ? `@${connector}: ${tool}` : `@${connector}: list tools`,
	},
	async execute({ connector, tool, arguments: args }, ctx) {
		const userId = appUserId(ctx.session.auth.current);
		if (!userId) return { error: "Sign in to use connectors." };
		const row = (await listMcp(db(), userId)).find((m) => m.name === connector);
		if (!row)
			return {
				error: `No connector named ${connector}. The user can add it in Settings > Custom connectors.`,
			};
		// A tool of this connector's toolkit only. Checked against its real list: a prefix
		// check would also pass CUSTOM_DEEPWIKI_X…'s tools for CUSTOM_DEEPWIKI.
		const tools = await toolkitTools(row.slug).catch(() => []);
		if (!tool)
			return tools.length
				? { tools }
				: {
						tools,
						note:
							row.auth === "none"
								? "No tools could be read from this server."
								: `No tools yet: it may not be connected (call connect_app with app ${row.slug.toLowerCase()}).`,
					};
		if (!tools.some((t) => t.slug === tool.toUpperCase()))
			return { error: `${tool} isn't a tool of @${connector}.` };
		const { Composio } = await import("@composio/core");
		const r = await new Composio().tools
			.execute(tool.toUpperCase(), {
				userId,
				arguments: args,
				dangerouslySkipVersionCheck: true,
			})
			.catch((e: Error) => ({
				successful: false,
				data: null,
				error: e.message,
			}));
		if (r.successful) return { data: r.data };
		const error = String(r.error ?? "The tool failed.");
		return /connect|auth|account/i.test(error) && row.auth !== "none"
			? {
					error,
					fix: `Not connected: call connect_app with app ${row.slug.toLowerCase()}, then try again.`,
				}
			: { error };
	},
});

export default defineDynamic(notInPlan(tool));
