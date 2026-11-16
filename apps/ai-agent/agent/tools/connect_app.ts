// Human in the loop for connected apps (eve docs: tools/workflows > Ask a human:
// ctx.ask). The turn pauses until the user connects the app or cancels; the web app
// shows the question as a Connect card and answers it.
import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { appUserId } from "../lib/db";

export default defineWorkflowTool({
	description:
		"Ask the user to connect an app (a Composio toolkit slug such as gmail) and wait until it is connected. Call it whenever an app has no active connection, then retry the task.",
	inputSchema: z.object({ app: z.string().min(1).max(100) }),
	async execute({ app }, ctx) {
		"use workflow";
		const userId = appUserId(ctx.session.auth.current);
		if (!userId) return { app, connected: false, reason: "Not signed in." };
		// A few rounds: the user may answer "connected" before Composio shows it.
		for (let round = 0; round < 3; round++) {
			if (await isConnected(userId, app)) return { app, connected: true };
			const answer = await ctx.ask({
				title: `Connect ${app}`,
				prompt: `Connect ${app} so I can continue.`,
				display: "confirmation",
				options: [
					{ id: "connected", label: "I've connected it", style: "primary" },
					{ id: "cancel", label: "Cancel" },
				],
			});
			if (answer.status !== "answered" || answer.optionId !== "connected")
				return { app, connected: false, reason: "The user didn't connect it." };
		}
		return { app, connected: false, reason: "It is still not connected." };
	},
});

// Composio docs: configuring-sessions > toolkits(). A session enabled for one toolkit
// lists only it, with its connection.
async function isConnected(userId: string, app: string) {
	"use step";
	const { Composio } = await import("@composio/core");
	const session = await new Composio().create(userId, {
		toolkits: [app],
		sandbox: { enable: false },
	});
	const [toolkit] = (await session.toolkits()).items;
	return !!toolkit?.connection?.connectedAccount?.id;
}
