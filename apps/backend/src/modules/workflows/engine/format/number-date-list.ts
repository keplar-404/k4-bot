import { toNumber, toTime } from "../conditions/values";

const UNIT_MS: Record<string, number> = { minutes: 60_000, hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 };

/** Number operations; a value that is not a number gives null (never NaN in the run's data). */
export function formatNumber(op: string, input: unknown, o: Record<string, string>): unknown {
  const n = toNumber(input);
  if (n === null) return null;
  const by = toNumber(o.value ?? "") ?? 0;
  const decimals = Math.min(10, Math.max(0, Number.parseInt(o.decimals ?? "2", 10) || 0));
  switch (op) {
    case "round":
      return Number(n.toFixed(decimals));
    case "add":
      return n + by;
    case "subtract":
      return n - by;
    case "multiply":
      return n * by;
    case "divide":
      return by === 0 ? null : n / by;
    case "format_number":
      return new Intl.NumberFormat(o.locale || "en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
    default:
      return undefined;
  }
}

/** Date operations on ISO text or epoch numbers; output ISO text, or formatted text for format_date. */
export function formatDate(op: string, input: unknown, o: Record<string, string>): unknown {
  const t = toTime(input);
  if (t === null) return null;
  try {
    switch (op) {
      case "add_time": {
        const ms = (toNumber(o.amount ?? "0") ?? 0) * (UNIT_MS[o.unit ?? "days"] ?? UNIT_MS.days!);
        return new Date(t + ms).toISOString();
      }
      case "format_date":
      case "to_timezone":
        return new Intl.DateTimeFormat(o.locale || "en-US", {
          timeZone: o.timezone || "UTC",
          dateStyle: (o.dateStyle as "short" | "medium" | "long" | "full") || "medium",
          timeStyle: op === "to_timezone" || o.timeStyle ? ((o.timeStyle as "short" | "medium") || "short") : undefined,
        }).format(t);
      default:
        return undefined;
    }
  } catch {
    // An unknown time zone or locale: say so in the data rather than failing the run.
    return null;
  }
}

/** List operations; text is read as a JSON list when it is one, else as one item. */
export function formatList(op: string, input: unknown, o: Record<string, string>): unknown {
  let list: unknown[] = Array.isArray(input) ? input : [];
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      list = Array.isArray(parsed) ? parsed : [input];
    } catch {
      list = input ? [input] : [];
    }
  }
  const show = (v: unknown) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? ""));
  switch (op) {
    case "join":
      return list.map(show).join(o.separator ?? ", ");
    case "first":
      return list[0] ?? null;
    case "last":
      return list.at(-1) ?? null;
    case "count":
      return list.length;
    case "unique":
      return [...new Map(list.map((v) => [show(v), v])).values()];
    default:
      return undefined;
  }
}
