import type { ScheduleConfig } from "./config";
import { nextOccurrence } from "./next";
import { isTimeZone } from "./zone";

const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440, weeks: 10080 } as const;

/** What is wrong with a schedule, or null. `minMinutes` is the shortest interval allowed. */
export function scheduleIssue(s: ScheduleConfig, minMinutes: number): string | null {
  if (!isTimeZone(s.timezone)) return `"${s.timezone}" is not a time zone. Use a name like Europe/Berlin.`;
  if (s.mode === "every" && s.every * UNIT_MINUTES[s.unit] < minMinutes) {
    return minMinutes >= 60
      ? `It can run at most every ${minMinutes / 60} hour${minMinutes > 60 ? "s" : ""}.`
      : `It can run at most every ${minMinutes} minutes.`;
  }
  if (s.mode === "weekly" && s.days.length === 0) return "Choose at least one day of the week.";
  if (s.mode === "once" && !s.date) return "Choose the date it runs.";
  if (s.mode === "once" && !nextOccurrence(s)) return "That date and time has already passed.";
  return null;
}
