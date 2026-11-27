import { expect, test } from "bun:test";
import { addDays, daysBetween, localTime, parseTime } from "./time";

test("localTime and parseTime", () => {
	const at = new Date("2026-11-28T08:05:00Z");
	expect(localTime(at, "Asia/Dhaka")).toBe(
		"Saturday 2026-11-28 14:05 (Asia/Dhaka, GMT+06:00)",
	);
	expect(parseTime("2026-12-25T15:00", "Asia/Dhaka")?.toISOString()).toBe(
		"2026-12-25T09:00:00.000Z",
	);
	expect(parseTime("nope", "UTC")).toBeNull();
	// Late evening in New York is already the next day in Dhaka.
	const a = new Date("2026-11-28T03:00:00Z");
	// New York DST ends Nov 1 2026: +7 days keeps 09:00 local (13:00Z → 14:00Z).
	expect(
		addDays(
			new Date("2026-10-29T13:00:00Z"),
			7,
			"America/New_York",
		).toISOString(),
	).toBe("2026-11-05T14:00:00.000Z");
	expect(daysBetween(a, new Date("2026-12-25T03:00:00Z"), "Asia/Dhaka")).toBe(
		27,
	);
});
