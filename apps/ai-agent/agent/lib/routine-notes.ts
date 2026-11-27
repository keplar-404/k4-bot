// Routines plug-in: a tool that replaces one of a routine's notes (steps, auto-OK list).
// Only offered in routine runs.
import { MAX_NOTES, routine } from "@repo/shared/routines";
import { and, eq } from "drizzle-orm";
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { db } from "./db";
import { forgetRoutineRun, routineRunOf } from "./routine";

export const notesTool = (field: "steps" | "autoOk", description: string) =>
	defineDynamic(async (ctx) => {
		if (!ctx.turn) return null;
		const found = await ctx.memo(`routine:${ctx.turn.id}`, () =>
			routineRunOf(ctx.session),
		);
		if (!found) return null;
		return defineTool({
			description,
			inputSchema: z.object({ text: z.string().min(1).max(MAX_NOTES) }),
			async execute({ text }) {
				await db()
					.update(routine)
					.set({ [field]: text })
					.where(
						and(
							eq(routine.id, found.routine.id),
							eq(routine.userId, found.run.userId),
						),
					);
				forgetRoutineRun(ctx.session.id);
				return { saved: true };
			},
		});
	});
