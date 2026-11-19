// Cua Driver on the user's computer: desktop apps through the accessibility tree
// (element tokens, background input), not screenshots.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { onComputer } from "../lib/computer";

export default defineTool({
	description:
		"Operate desktop apps (LibreOffice, GIMP, file manager…) on the user's computer with Cua Driver: call one driver tool such as list_windows, launch_app, get_window_state, run_steps, click, type_text, invoke_menu or verify_state with its JSON args. Load the `cua-driver` skill first for the loop and rules. The user watches the desktop live.",
	inputSchema: z.object({
		tool: z
			.string()
			.regex(/^[a-z][a-z0-9_]{1,63}$/)
			.describe("Cua Driver tool name, e.g. get_window_state"),
		args: z.record(z.string(), z.unknown()).default({}),
	}),
	label: { start: ({ tool }) => `Desktop: ${tool}` },
	async execute({ tool, args }, ctx) {
		// One driver session per chat: element tokens from a read stay valid for the
		// next call, and parallel chats keep their own snapshots (Cua: sessions).
		const input: Record<string, unknown> = {
			session: `k4-${ctx.session.id}`,
			...args,
		};
		// Text only: screenshots can't reach the model here, and the tree is the point.
		if (tool === "get_window_state") input.include_screenshot ??= false;
		return onComputer(ctx, `cua-driver call ${tool}`, {
			stdin: JSON.stringify(input),
			timeoutMs: 120_000,
			signal: ctx.abortSignal,
		});
	},
});
