// Copies a file the user attached (R2) onto the agent's computer, when the agent
// decides it needs it there. The model already sees the file; this moves the bytes,
// straight R2 → computer.
import { cleanFileName, ownsKey } from "@repo/shared/files";
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { appUserId } from "../lib/db";
import { r2ToComputer } from "../lib/files";
import { notInPlan } from "../lib/mode";

const tool = defineTool({
	description:
		"Copy a file from the chat (one the user attached, or one you shared) onto your computer, into ~/Uploads, by its file id. Use it only when you need the file on the computer (to edit, convert or open it).",
	inputSchema: z.object({ fileId: z.string().min(1).max(1024) }),
	label: { start: () => "Copy the file to the computer" },
	async execute({ fileId }, ctx) {
		const userId = appUserId(ctx.session.auth.current);
		// Only the user's own files: the id is a key under their prefix.
		if (!userId || !ownsKey(userId, fileId)) return { error: "No such file." };
		const name =
			cleanFileName(decodeURIComponent(fileId.split("/").pop() ?? "")) ??
			"file";
		return r2ToComputer(ctx, fileId, name, "Uploads");
	},
});

export default defineDynamic(notInPlan(tool));
