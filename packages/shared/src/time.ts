// Time helpers for the agent: the user's local time (added to each message's context)
// and the `time` tool. No date library.
import { validTimezone, zonedTime } from "./routines";

export { validTimezone };

const parts = (at: Date, timeZone: string) =>
	Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			weekday: "long",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			timeZoneName: "longOffset",
		})
			.formatToParts(at)
			.map((p) => [p.type, p.value]),
	) as Record<string, string>;

/** "Friday 2026-11-28 14:05 (Asia/Dhaka, GMT+06:00)". */
export function localTime(at: Date, timeZone: string) {
	const p = parts(at, timeZone);
	return `${p.weekday} ${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} (${timeZone}, ${p.timeZoneName})`;
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/;
/** "2026-12-25" or "2026-12-25T15:00" as a wall-clock time in `timeZone`; or an ISO instant. */
export function parseTime(s: string, timeZone: string): Date | null {
	const m = LOCAL.exec(s.trim());
	if (m) {
		const [y, mo, d, h = "0", mi = "0"] = m.slice(1);
		return zonedTime(+y, +mo, +d, +h, +mi, timeZone);
	}
	const t = new Date(s);
	return Number.isNaN(t.getTime()) ? null : t;
}

/** `at` moved by whole days on the wall clock of `timeZone` (09:00 stays 09:00 across DST). */
export function addDays(at: Date, days: number, timeZone: string) {
	const p = parts(at, timeZone);
	const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + days));
	return zonedTime(
		d.getUTCFullYear(),
		d.getUTCMonth() + 1,
		d.getUTCDate(),
		+p.hour,
		+p.minute,
		timeZone,
	);
}

/** Whole calendar days from a to b, as seen in `timeZone`. */
export function daysBetween(a: Date, b: Date, timeZone: string) {
	const day = (d: Date) => {
		const p = parts(d, timeZone);
		return Date.UTC(+p.year, +p.month - 1, +p.day);
	};
	return Math.round((day(b) - day(a)) / 86_400_000);
}
