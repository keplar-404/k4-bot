// eve docs, memory/custom-provider: the user's memory note (@repo/shared/memory),
// keyed by the verified user id, so the user can also edit it in Settings > Memory.
import {
	MAX_MEMORY_CHARS,
	memoryFacts,
	readMemory,
	replaceMemory,
} from "@repo/shared/memory";
import { defineMemory, defineMemoryProvider } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { appUserId, db } from "../lib/db";
import { modeOf } from "../lib/mode";

type Auth = Parameters<typeof appUserId>[0];
const userOf = (ctx: { session: { auth: { current: Auth } } }) =>
	appUserId(ctx.session.auth.current);

const profileMemory = defineMemoryProvider({
	recall: {
		async "turn.started"(ctx) {
			const userId = userOf(ctx);
			if (!userId) return null;
			const facts = memoryFacts(await readMemory(db(), userId));
			return {
				// A stable id: each turn's recall replaces the last, so edits made in
				// Settings reach the agent on the next turn.
				messages: [
					{
						id: "profile",
						content: facts.length
							? `What you remember about the user:\n${facts.map((f) => `- ${f}`).join("\n")}`
							: "You have nothing saved about the user yet.",
					},
				],
			};
		},
	},
	async tools(ctx) {
		const userId = userOf(ctx);
		// Plan mode only reads the web; memory is still recalled above.
		if (!userId || modeOf(ctx.session) === "plan") return null;
		return {
			// The only memory write: rewrites everything, so the user approves every call (eve docs: Human
			// in the Loop > Approvals). A tricked model can't wipe memory unseen.
			update: defineTool({
				description:
					"Replace the whole memory note with new text, one fact per line. Use it to correct, merge or remove facts. The user must approve each call.",
				inputSchema: z.object({ content: z.string().max(MAX_MEMORY_CHARS) }),
				approval: always(),
				async execute({ content }) {
					return { saved: await replaceMemory(db(), userId, content) };
				},
			}),
		};
	},
});

export default defineMemory({
	description: "Remember stable facts and preferences about the user.",
	provider: profileMemory,
	scope: byPrincipal,
});
