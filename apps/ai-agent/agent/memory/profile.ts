// eve docs, memory/custom-provider: the user's memory note (@repo/shared/memory),
// keyed by the verified user id, so the user can also edit it in Settings > Memory.
import {
	appendMemory,
	memoryFacts,
	readMemory,
	removeMemoryFact,
} from "@repo/shared/memory";
import { defineMemory, defineMemoryProvider } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { appUserId, db } from "../lib/db";

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
							? `What you remember about the user (numbered; remove by number):\n${facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}`
							: "You have nothing saved about the user yet.",
					},
				],
			};
		},
	},
	async tools(ctx) {
		const userId = userOf(ctx);
		if (!userId) return null;
		return {
			save: defineTool({
				description:
					"Save one lasting fact or preference about the user (one short sentence).",
				inputSchema: z.object({ fact: z.string().trim().min(1).max(500) }),
				async execute({ fact }) {
					if (!(await appendMemory(db(), userId, fact)))
						throw new Error(
							"Memory is full. Remove outdated facts first, or ask the user to edit it in Settings.",
						);
					return { saved: fact };
				},
			}),
			remove: defineTool({
				description:
					"Remove one saved fact about the user by its number in the recalled list.",
				inputSchema: z.object({ number: z.number().int().min(1) }),
				async execute({ number }) {
					return { removed: await removeMemoryFact(db(), userId, number) };
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
