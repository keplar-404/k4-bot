/** Wall-clock parts of an instant in a time zone. */
export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    // Throws RangeError for an unknown zone: callers validate the zone first (isTimeZone).
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isTimeZone(timeZone: string) {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function localParts(ms: number, timeZone: string): LocalParts {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(ms).map((p) => [p.type, Number(p.value)]));
  return { year: parts.year!, month: parts.month!, day: parts.day!, hour: parts.hour!, minute: parts.minute! };
}

/** The zone's offset from UTC at an instant, in ms (Berlin in summer: +2 h). */
function offsetAt(ms: number, timeZone: string) {
  const p = localParts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000;
}

/**
 * The instant a wall-clock time happens in a zone. Corrected once with the offset at the result, so a time just
 * after a DST change is right; a time that does not exist (skipped by spring-forward) lands an hour later.
 */
export function zonedTime(day: { year: number; month: number; day: number }, hhmm: string, timeZone: string) {
  const [hour, minute] = hhmm.split(":").map(Number);
  const asUtc = Date.UTC(day.year, day.month - 1, day.day, hour!, minute!);
  const first = asUtc - offsetAt(asUtc, timeZone);
  return asUtc - offsetAt(first, timeZone);
}
