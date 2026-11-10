import type { RunRange } from "../../api";

/** How the overview names each period: the toggle, the chart title, and the hint under every number. */
export const RANGE_INFO: Record<
  RunRange,
  { toggle: string; title: string; period: string; short: string }
> = {
  day: {
    toggle: "Day",
    title: "Runs per day",
    period: "Last 14 days",
    short: "14d",
  },
  week: {
    toggle: "Week",
    title: "Runs per week",
    period: "Last 12 weeks",
    short: "12w",
  },
  month: {
    toggle: "Month",
    title: "Runs per month",
    period: "Last 12 months",
    short: "12m",
  },
  year: {
    toggle: "Year",
    title: "Runs per year",
    period: "Last 5 years",
    short: "5y",
  },
};

export const RANGES = Object.keys(RANGE_INFO) as RunRange[];

/** A bar's label on the axis (short) and in its tooltip (long), from its UTC start date. */
export function bucketLabel(start: string, range: RunRange, long = false) {
  const d = new Date(`${start}T00:00:00Z`);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString(undefined, { ...o, timeZone: "UTC" });
  if (range === "year") return fmt({ year: "numeric" });
  if (range === "month")
    return fmt(long ? { month: "long", year: "numeric" } : { month: "short" });
  if (range === "week")
    return long
      ? `Week of ${fmt({ month: "short", day: "numeric", year: "numeric" })}`
      : fmt({ month: "short", day: "numeric" });
  return fmt(
    long
      ? { weekday: "short", month: "short", day: "numeric" }
      : { month: "short", day: "numeric" },
  );
}
