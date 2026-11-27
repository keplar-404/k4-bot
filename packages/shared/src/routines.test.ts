import { expect, test } from "bun:test";
import { needsUser, nextRun, slugsIn, zonedTime } from "./routines";

const iso = (d: Date | null) => d?.toISOString() ?? null;

test("zonedTime handles fixed and DST zones", () => {
	expect(iso(zonedTime(2026, 12, 1, 9, 0, "Asia/Dhaka"))).toBe(
		"2026-12-01T03:00:00.000Z",
	);
	// New York: EST in winter (-5), EDT in summer (-4).
	expect(iso(zonedTime(2026, 1, 15, 9, 0, "America/New_York"))).toBe(
		"2026-01-15T14:00:00.000Z",
	);
	expect(iso(zonedTime(2026, 7, 15, 9, 0, "America/New_York"))).toBe(
		"2026-07-15T13:00:00.000Z",
	);
});

test("nextRun", () => {
	const base = { startAt: "2026-12-01T09:00", timezone: "Asia/Dhaka" };
	const now = new Date("2026-11-27T00:00:00Z");
	// Before the start: the start itself.
	expect(iso(nextRun({ ...base, repeat: "once" }, now))).toBe(
		"2026-12-01T03:00:00.000Z",
	);
	expect(
		nextRun({ ...base, repeat: "once" }, new Date("2026-12-02T00:00:00Z")),
	).toBeNull();
	// Daily, after a run at 03:00Z on Dec 1: Dec 2.
	const ran = new Date("2026-12-01T03:00:00Z");
	expect(iso(nextRun({ ...base, repeat: "daily" }, ran))).toBe(
		"2026-12-02T03:00:00.000Z",
	);
	// Dec 1 2026 is a Tuesday: weekly → Dec 8; weekdays from Fri Dec 4 → Mon Dec 7.
	expect(iso(nextRun({ ...base, repeat: "weekly" }, ran))).toBe(
		"2026-12-08T03:00:00.000Z",
	);
	expect(
		iso(
			nextRun(
				{ ...base, repeat: "weekdays" },
				new Date("2026-12-04T03:00:00Z"),
			),
		),
	).toBe("2026-12-07T03:00:00.000Z");
	// Monthly on the 31st skips months without one.
	expect(
		iso(
			nextRun(
				{ startAt: "2027-01-31T08:00", timezone: "UTC", repeat: "monthly" },
				new Date("2027-01-31T08:00:00Z"),
			),
		),
	).toBe("2027-03-31T08:00:00.000Z");
});

test("needsUser and slugsIn", () => {
	expect(needsUser("GMAIL_SEND_EMAIL")).toBe(true);
	expect(needsUser("SLACK_CHAT_POST_MESSAGE")).toBe(true);
	expect(needsUser("GITHUB_MERGE_A_PULL_REQUEST")).toBe(true);
	expect(needsUser("GMAIL_CREATE_EMAIL_DRAFT")).toBe(false);
	expect(needsUser("GOOGLESHEETS_BATCH_UPDATE")).toBe(false);
	expect(needsUser("GMAIL_FETCH_EMAILS")).toBe(false);
	expect(
		slugsIn({ tools: [{ tool_slug: "GMAIL_SEND_EMAIL" }, { tool_slug: "X" }] }),
	).toEqual(["GMAIL_SEND_EMAIL", "X"]);
	expect(slugsIn({ connector: "a", tool: "post_thing" })).toEqual([
		"post_thing",
	]);
});
