// The Browser Use harness on the user's computer: Python run against the agent's own
// Chrome (lib/browser.ts adds parallel slots, shared logins and the visible tab).
// For everyday steps the simpler `browser` tool is easier; this one is for the rest.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { runBrowser } from "../lib/browser";

export default defineTool({
	description:
		"Advanced: control Chrome on the user's computer with Browser Use harness Python (pre-imported helpers: new_tab, goto_url, page_info, wait_for_load, click_at_xy, js, cdp, list_tabs, switch_tab…); print what you need. Prefer the simpler `browser` tool; use this for anything it can't do. Load the `browser-use` skill first. The user watches live and can take control (captcha, sign-in).",
	inputSchema: z.object({
		script: z.string().min(1).max(20_000),
	}),
	label: { start: () => "Use the browser (script)" },
	async execute({ script }, ctx) {
		return runBrowser(ctx, script);
	},
});
