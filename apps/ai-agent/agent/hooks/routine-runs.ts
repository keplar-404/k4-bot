// Routines plug-in: when a routine run's first turn ends,
// - marks the run done or failed, for the routine page's counts (a draft already set
//   "needs_you", which stays);
// - if it succeeded but the agent didn't save its notes, asks it once to save them, so
//   the next run gets the steps whatever the model chose to do.
// Only the first turn counts (endedAt still empty): follow-ups in the chat change nothing.
import { routineRun } from "@repo/shared/routines";
import { and, eq, isNull } from "drizzle-orm";
import { calls } from "eve/events";
import { defineHook } from "eve/hooks";
import { db } from "../lib/db";
import { routineRunOf } from "../lib/routine";

const NOTES = ["routine_steps", "routine_auto_ok"];

export default defineHook({
	events: {
		async "turn.settled"(event, ctx) {
			const session = { id: ctx.session.id, auth: ctx.session.auth };
			const found = await routineRunOf(session).catch(() => null);
			if (!found) return;
			const data = event.data as {
				turnId?: string;
				outcome?: string;
				error?: { message?: string };
			};
			const failed = data.outcome !== "completed";
			const [ended] = await db()
				.update(routineRun)
				.set({
					...(found.run.status === "running" || failed
						? {
								status: failed ? ("failed" as const) : ("ok" as const),
								error: failed
									? (data.error?.message ?? data.outcome ?? null)
									: null,
							}
						: {}),
					endedAt: new Date(),
				})
				.where(and(eq(routineRun.id, found.run.id), isNull(routineRun.endedAt)))
				.returning({ id: routineRun.id })
				.catch((e) => {
					console.error("routine run status not saved", e);
					return [];
				});
			if (!ended || failed) return;
			const saved = new Set(
				calls(ctx.view, { kind: "tool", turnId: data.turnId }).map(
					(c) => c.name,
				),
			);
			const missing = NOTES.filter((n) => !saved.has(n));
			if (missing.length)
				ctx.continue(
					`The routine run is finished. Now call ${missing.map((n) => `\`${n}\``).join(" and ")} to save your notes for the next run (short numbered lists; for routine_auto_ok write "None" if every action needed approval). Then reply only "Notes saved."`,
				);
		},
	},
});
