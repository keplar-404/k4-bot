// Deletes one of the user's files from the cloud (R2), when the user asks: a file
// they attached or one the agent shared. Files on the computer are removed with
// computer_shell.
import { ownsKey } from "@repo/shared/files";
import { deleteFile } from "@repo/shared/r2";
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { appUserId } from "../lib/db";
import { notInPlan } from "../lib/mode";

const tool = defineTool({
	description:
		"Delete a file from the chat's cloud storage by its file id (an attached or shared file), only when the user asks. Its download card stops working.",
	inputSchema: z.object({ fileId: z.string().min(1).max(1024) }),
	label: { start: () => "Delete a file" },
	async execute({ fileId }, ctx) {
		const userId = appUserId(ctx.session.auth.current);
		if (!userId || !ownsKey(userId, fileId)) return { error: "No such file." };
		await deleteFile(fileId);
		return { deleted: fileId };
	},
});

export default defineDynamic(notInPlan(tool));
