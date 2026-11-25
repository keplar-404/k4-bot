// Gives the user a file from the agent's computer as a download card. The computer
// uploads it straight to R2 (lib/files.ts); no bytes pass through this process.
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { fromComputer } from "../lib/files";
import { notInPlan } from "../lib/mode";

const tool = defineTool({
	description:
		"Give the user a file from your computer as a download card in the chat (up to 100 MB; from your home, ~/Shared or /tmp).",
	inputSchema: z.object({
		path: z
			.string()
			.min(1)
			.max(4096)
			.regex(/^[^\n]+$/),
	}),
	label: { start: ({ path }) => `Share ${path.split("/").pop()}` },
	execute: ({ path }, ctx) => fromComputer(ctx, path),
});

export default defineDynamic(notInPlan(tool));
