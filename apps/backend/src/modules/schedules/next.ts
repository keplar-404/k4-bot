import type { ScheduleConfig } from "./config";
import { localParts, zonedTime } from "./zone";

const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 } as const;

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * When a schedule is next due after `from` (ms), or null when it never is again (a "once" in the past). The
 * per-minute cron starts what is due, so an interval lands on a whole minute.
 */
export function nextOccurrence(s: ScheduleConfig, from = Date.now()): Date | null {
  if (s.mode === "every") return new Date(Math.ceil((from + s.every * UNIT_MS[s.unit]) / 60_000) * 60_000);
  if (s.mode === "once") {
    if (!s.date) return null;
    const [year, month, day] = s.date.split("-").map(Number);
    const at = zonedTime({ year: year!, month: month!, day: day! }, s.at, s.timezone);
    return at > from ? new Date(at) : null;
  }

  // Walk forward day by day (in the zone's calendar) to the first matching day whose time is still ahead.
  const today = localParts(from, s.timezone);
  for (let i = 0; i <= 366; i++) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const day = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
    if (!matches(s, day, date.getUTCDay())) continue;
    const at = zonedTime(day, s.at, s.timezone);
    if (at > from) return new Date(at);
  }
  return null;
}

function matches(s: ScheduleConfig, day: { year: number; month: number; day: number }, weekday: number) {
  if (s.mode === "weekly") return s.days.includes(weekday);
  if (s.mode === "monthly") return day.day === Math.min(s.dayOfMonth, daysInMonth(day.year, day.month));
  return true;
}
