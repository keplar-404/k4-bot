// Starts one routine run as its user, on the routines channel (Routines plug-in).
// Used by the dispatcher schedule and by the routine tool's Run test.
import { createRun } from "@repo/shared/routines";
import { localTime } from "@repo/shared/time";
import routines from "../channels/routines";
import { db } from "./db";

// The `to` that tools and schedule handlers get (eve doesn't export its type).
type To = (
	channel: typeof routines,
	target: { runId: string; userId: string },
) => { send(message: string, options: object): Promise<{ sessionId: string }> };

export async function startRun(
	to: To,
	r: {
		id: string;
		userId: string;
		name: string;
		instructions: string;
		timezone: string;
	},
	trigger: "schedule" | "agent",
) {
	const { runId, chatId, prompt } = await createRun(db(), r, trigger);
	const delivery = await to(routines, { runId, userId: r.userId }).send(
		prompt,
		{
			// The run is the user's own work: their grants, their chat. Full mode: nobody is
			// there to approve; the routine gate and instructions hold back what needs them.
			auth: {
				authenticator: "neon-auth",
				principalId: r.userId,
				principalType: "user",
				attributes: { mode: "full", routineRun: runId, tz: r.timezone },
			},
			idempotencyKey: `routine:${runId}`,
			title: r.name,
			// Same as a web message: the user's local time rides with the message.
			context: [
				JSON.stringify({ userLocalTime: localTime(new Date(), r.timezone) }),
			],
		},
	);
	return { runId, chatId, sessionId: delivery.sessionId };
}
