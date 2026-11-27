// Time zones and date math, done exactly instead of by the model. The user's own time
// zone (sent by the browser, or the routine's) is the default; their local time is
// already in each message's context, so this is for other zones and for date math.
import {
	addDays,
	daysBetween,
	localTime,
	parseTime,
	validTimezone,
} from "@repo/shared/time";
import { defineTool } from "eve/tools";
import { z } from "zod";

const zone = z
	.string()
	.max(64)
	.refine(
		validTimezone,
		"An IANA time zone, e.g. Asia/Dhaka or America/New_York",
	);

export default defineTool({
	description:
		'Exact time zone and date math. `now`: the current time in `zone`. `convert`: what `time` in `zone` is in `to`. `between`: days and hours from `time` to `until`. `add`: `time` plus `days`/`hours`/`minutes` (negative to subtract). Times are "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" in `zone`; `zone` defaults to the user\'s own.',
	inputSchema: z.object({
		action: z.enum(["now", "convert", "between", "add"]),
		time: z.string().max(40).optional(),
		zone: zone.optional(),
		to: zone.optional(),
		until: z.string().max(40).optional(),
		days: z.number().int().min(-36_500).max(36_500).optional(),
		hours: z.number().min(-876_000).max(876_000).optional(),
		minutes: z.number().min(-52_560_000).max(52_560_000).optional(),
	}),
	label: { start: ({ action }) => `Time: ${action}` },
	async execute(i, ctx) {
		const own = ctx.session.auth.current?.attributes.tz;
		const tz = i.zone ?? (typeof own === "string" ? own : "UTC");
		const at = i.time ? parseTime(i.time, tz) : new Date();
		if (!at) return { error: `Can't read the time "${i.time}".` };
		switch (i.action) {
			case "now":
			case "convert": {
				const out = i.action === "convert" ? (i.to ?? tz) : tz;
				return { time: localTime(at, out), from: localTime(at, tz) };
			}
			case "between": {
				const end = i.until ? parseTime(i.until, tz) : null;
				if (!end) return { error: "between needs `until`." };
				const ms = end.getTime() - at.getTime();
				return {
					calendarDays: daysBetween(at, end, tz),
					hours: Math.round((ms / 3_600_000) * 100) / 100,
					from: localTime(at, tz),
					until: localTime(end, tz),
				};
			}
			case "add": {
				// Days move the wall clock (09:00 stays 09:00 across a DST change); hours and
				// minutes are elapsed time.
				const shifted = i.days ? addDays(at, i.days, tz) : at;
				const result = new Date(
					shifted.getTime() + ((i.hours ?? 0) * 60 + (i.minutes ?? 0)) * 60_000,
				);
				return { time: localTime(result, tz) };
			}
		}
	},
});
