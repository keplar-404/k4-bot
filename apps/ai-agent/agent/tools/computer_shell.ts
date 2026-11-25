// A shell on the user's own cloud computer (lib/computer.ts). Each call is its own
// process, so parallel chats never get in each other's way.
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { onComputer } from "../lib/computer";
import { notInPlan } from "../lib/mode";

const tool = defineTool({
	description:
		"Run a bash command on the user's cloud computer (Ubuntu 22.04), as your own Linux user on your own desktop, which the user can watch live. Your home folder persists; ~/Shared is shared with the user's other agents. Install apps with `sudo k4-install PKG...` (Ubuntu package names; the only sudo allowed) or user-level tools (pip --user, uv). Use it for files, installing software, running code, and starting GUI apps in the background (e.g. `setsid libreoffice --calc file.ods >/dev/null 2>&1 &`). Returns exit code, stdout and stderr.",
	inputSchema: z.object({
		command: z.string().min(1).max(20_000),
		timeoutSeconds: z.number().int().min(1).max(600).default(120),
	}),
	label: {
		start: ({ command }) => `Run \`${command.slice(0, 60)}\` on the computer`,
	},
	async execute({ command, timeoutSeconds }, ctx) {
		return onComputer(ctx, command, {
			timeoutMs: timeoutSeconds * 1000,
			signal: ctx.abortSignal,
		});
	},
});

export default defineDynamic(notInPlan(tool));
