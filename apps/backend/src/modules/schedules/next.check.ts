// bun run src/modules/schedules/next.check.ts
import assert from "node:assert/strict";
import { scheduleConfig } from "./config";
import { scheduleIssue } from "./issues";
import { nextOccurrence } from "./next";

const s = (v: Record<string, unknown>) => scheduleConfig.parse(v);
const at = (iso: string) => Date.parse(iso);
const iso = (d: Date | null) => d?.toISOString() ?? null;

// Old configs still parse and keep their meaning.
assert.equal(s({ every: 2, unit: "hours", timezone: "UTC" }).mode, "every");
assert.equal(iso(nextOccurrence(s({ every: 2, unit: "hours" }), at("2026-03-01T10:00:30Z"))), "2026-03-01T12:01:00.000Z");

// Daily in a zone: today if still ahead, else tomorrow.
const daily = s({ mode: "daily", at: "09:00", timezone: "Europe/Berlin" });
assert.equal(iso(nextOccurrence(daily, at("2026-01-10T07:00:00Z"))), "2026-01-10T08:00:00.000Z");
assert.equal(iso(nextOccurrence(daily, at("2026-01-10T08:00:00Z"))), "2026-01-11T08:00:00.000Z");
// Across DST (Berlin moves to +2 on 2026-03-29): 09:00 stays 09:00 local.
assert.equal(iso(nextOccurrence(daily, at("2026-03-29T06:00:00Z"))), "2026-03-29T07:00:00.000Z");
// New York, evening time that is "tomorrow" in UTC.
const ny = s({ mode: "daily", at: "21:30", timezone: "America/New_York" });
assert.equal(iso(nextOccurrence(ny, at("2026-07-01T12:00:00Z"))), "2026-07-02T01:30:00.000Z");

// Weekly: Monday and Friday. 2026-01-07 is a Wednesday.
const weekly = s({ mode: "weekly", days: [1, 5], at: "08:00", timezone: "UTC" });
assert.equal(iso(nextOccurrence(weekly, at("2026-01-07T12:00:00Z"))), "2026-01-09T08:00:00.000Z");
assert.equal(iso(nextOccurrence(weekly, at("2026-01-09T08:00:00Z"))), "2026-01-12T08:00:00.000Z");

// Monthly on the 31st: the last day of shorter months.
const monthly = s({ mode: "monthly", dayOfMonth: 31, at: "12:00", timezone: "UTC" });
assert.equal(iso(nextOccurrence(monthly, at("2026-02-01T00:00:00Z"))), "2026-02-28T12:00:00.000Z");
assert.equal(iso(nextOccurrence(monthly, at("2026-02-28T12:00:00Z"))), "2026-03-31T12:00:00.000Z");

// Once: in the future, then never again.
const once = s({ mode: "once", date: "2030-05-01", at: "10:15", timezone: "Asia/Tokyo" });
assert.equal(iso(nextOccurrence(once, at("2030-01-01T00:00:00Z"))), "2030-05-01T01:15:00.000Z");
assert.equal(nextOccurrence(once, at("2030-05-01T01:15:00Z")), null);

// Issues.
assert.match(scheduleIssue(s({ every: 1, unit: "minutes" }), 5)!, /every 5 minutes/);
assert.match(scheduleIssue(s({ every: 30, unit: "minutes" }), 60)!, /every 1 hour/);
assert.match(scheduleIssue(s({ mode: "daily", timezone: "Mars/Base" }), 5)!, /not a time zone/);
assert.match(scheduleIssue(s({ mode: "weekly", days: [] }), 5)!, /at least one day/);
assert.match(scheduleIssue(s({ mode: "once", date: "2001-01-01" }), 5)!, /already passed/);
assert.equal(scheduleIssue(daily, 5), null);

console.log("schedules ok");
