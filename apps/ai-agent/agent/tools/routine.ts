// Routines plug-in: lets the agent in a normal chat create a routine (the same fields as
// the web form) and start a test run. The routine's notes (steps, auto-OK list) are only
// written inside routine runs.
import {
	MAX_ROUTINES,
	nextRun,
	REPEATS,
	routine,
	validStart,
	validTimezone,
} from "@repo/shared/routines";
import { and, count, eq } from "drizzle-orm";
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { appUserId, db } from "../lib/db";
import { notInPlan } from "../lib/mode";
import { routineRunOf } from "../lib/routine";
import { startRun } from "../lib/start-run";

const tool = defineTool({
	description:
		"Create a routine: a job you run on a schedule, each run in its own chat that the user finds under Routines in the sidebar. `create` needs name, instructions (what to do each run, written for yourself), startAt (YYYY-MM-DDTHH:mm in the user's time), repeat and timezone (IANA, e.g. Asia/Dhaka). `run_test` starts one run now (needs routineId). Confirm the time and repeat with the user first.",
	inputSchema: z.object({
		action: z.enum(["create", "run_test"]),
		name: z.string().trim().min(1).max(60).optional(),
		instructions: z.string().trim().min(1).max(4000).optional(),
		startAt: z.string().refine(validStart, "YYYY-MM-DDTHH:mm").optional(),
		repeat: z.enum(REPEATS).optional(),
		timezone: z
			.string()
			.max(64)
			.refine(validTimezone, "IANA timezone")
			.optional(),
		routineId: z.string().uuid().optional(),
	}),
	label: {
		start: ({ action, name }) =>
			action === "create" ? `Create routine ${name ?? ""}` : "Start a test run",
	},
	async execute(input, ctx) {
		const userId = appUserId(ctx.session.auth.current);
		if (!userId) return { error: "Sign in to use routines." };
		if (input.action === "create") {
			const { name, instructions, startAt, repeat, timezone } = input;
			if (!name || !instructions || !startAt || !repeat || !timezone)
				return {
					error:
						"create needs name, instructions, startAt, repeat and timezone",
				};
			const [{ n }] = await db()
				.select({ n: count() })
				.from(routine)
				.where(eq(routine.userId, userId));
			if (n >= MAX_ROUTINES)
				return { error: `The user already has ${MAX_ROUTINES} routines.` };
			const timing = { startAt, repeat, timezone };
			const [row] = await db()
				.insert(routine)
				.values({
					id: crypto.randomUUID(),
					userId,
					name,
					instructions,
					...timing,
					nextRunAt: nextRun(timing, new Date()),
				})
				.returning({ id: routine.id, nextRunAt: routine.nextRunAt });
			return {
				created: true,
				routineId: row.id,
				nextRunAt: row.nextRunAt,
				page: `/dashboard/routines/${row.id}`,
			};
		}
		if (!input.routineId) return { error: "run_test needs routineId" };
		const [r] = await db()
			.select()
			.from(routine)
			.where(and(eq(routine.id, input.routineId), eq(routine.userId, userId)));
		if (!r) return { error: "No such routine." };
		const run = await startRun(ctx.to, r, "agent");
		return {
			started: true,
			page: `/dashboard/routines/${r.id}/runs/${run.chatId}`,
		};
	},
});

// Normal chats only: hidden in routine runs (a run never makes routines) and in Plan
// mode. Same per-turn memo key as the routine-only tools, so one lookup serves all.
export default defineDynamic(async (ctx) => {
	if (!notInPlan(tool)(ctx)) return null;
	if (!ctx.turn) return tool;
	const run = await ctx.memo(`routine:${ctx.turn.id}`, () =>
		routineRunOf(ctx.session),
	);
	return run ? null : tool;
});
