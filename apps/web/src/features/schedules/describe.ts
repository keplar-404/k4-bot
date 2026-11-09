import type { ScheduleConfig } from "@backend/modules/schedules/config";

export type { ScheduleConfig };

export const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const ordinal = (n: number) => {
  if (n === 31) return "last day";
  const end =
    n % 10 === 1 && n !== 11
      ? "st"
      : n % 10 === 2 && n !== 12
        ? "nd"
        : n % 10 === 3 && n !== 13
          ? "rd"
          : "th";
  return `${n}${end}`;
};

/** "Every day at 09:00", "Mon, Fri at 08:00", "Once on 2026-05-01 at 10:15", "Every 2 hours". */
export function describeSchedule(s: ScheduleConfig): string {
  switch (s.mode) {
    case "every": {
      const word = s.every === 1 ? s.unit.replace(/s$/, "") : s.unit;
      return s.every === 1 ? `Every ${word}` : `Every ${s.every} ${word}`;
    }
    case "once":
      return s.date ? `Once on ${s.date} at ${s.at}` : "Once (choose a date)";
    case "daily":
      return `Every day at ${s.at}`;
    case "weekly":
      return s.days.length
        ? `${[...s.days]
            .sort()
            .map((d) => WEEKDAYS[d])
            .join(", ")} at ${s.at}`
        : "Weekly (choose days)";
    case "monthly":
      return `Monthly on the ${ordinal(s.dayOfMonth)} at ${s.at}`;
  }
}

/** A new schedule in the browser's own time zone. */
export const defaultSchedule = (): ScheduleConfig => ({
  mode: "daily",
  every: 1,
  unit: "hours",
  at: "09:00",
  days: [1],
  dayOfMonth: 1,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
});
