// Routines plug-in: the channel a run's session starts on when the agent itself starts
// it (the dispatcher schedule, the routine tool's Run test). It only maps a run to its
// own conversation; the user reads and continues it in the web chat like any chat.
import { routineRun } from "@repo/shared/routines";
import { chat } from "@repo/shared/schema";
import { and, eq, isNull } from "drizzle-orm";
import { defineChannel, GET } from "eve/channels";
import { db } from "../lib/db";

export default defineChannel({
	// A channel needs a route; this one only says the module is loaded.
	routes: [GET("/routines/health", async () => Response.json({ ok: true }))],
	async receive({ message, target, ...send }, { from }) {
		const { runId, userId } = target as { runId: string; userId: string };
		const delivery = await from(`routine-run:${runId}`).send(message, send);
		// The web chat opens the run by its chat's session id.
		const [run] = await db()
			.update(routineRun)
			.set({ sessionId: delivery.sessionId })
			.where(
				and(
					eq(routineRun.id, runId),
					eq(routineRun.userId, userId),
					isNull(routineRun.sessionId),
				),
			)
			.returning({ chatId: routineRun.chatId });
		if (run)
			await db()
				.update(chat)
				.set({ eveSessionId: delivery.sessionId })
				.where(and(eq(chat.id, run.chatId), eq(chat.userId, userId)));
		return delivery;
	},
});
