// Routines plug-in: one fixed schedule starts every routine that is due. The routine
// table is the source of truth (the web edits it); this only reads due rows. Every 15
// minutes: Vercel Hobby's limit, and rare enough that Neon can still sleep in between.
// shortcut: runs start up to 15 min after their time; use "*/5" on Vercel Pro if that matters.
import { nextRun, routine } from "@repo/shared/routines";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { defineSchedule } from "eve/schedules";
import { db } from "../lib/db";
import { startRun } from "../lib/start-run";

const BATCH = 25;

export default defineSchedule({
	cron: "*/15 * * * *",
	timezone: "UTC",
	async run({ to, waitUntil }) {
		const now = new Date();
		const due = await db()
			.select()
			.from(routine)
			.where(
				and(
					eq(routine.enabled, true),
					isNotNull(routine.nextRunAt),
					lte(routine.nextRunAt, now),
				),
			)
			.limit(BATCH);
		for (const r of due) {
			// Claim it: move nextRunAt on only while it is still due, so a run starts once
			// even when two dispatchers overlap.
			const [claimed] = await db()
				.update(routine)
				.set({ nextRunAt: nextRun(r, now) })
				.where(and(eq(routine.id, r.id), lte(routine.nextRunAt, now)))
				.returning({ id: routine.id });
			if (!claimed) continue;
			waitUntil(
				startRun(to, r, "schedule").catch((e) =>
					console.error("routine run failed to start", r.id, e),
				),
			);
		}
	},
});
