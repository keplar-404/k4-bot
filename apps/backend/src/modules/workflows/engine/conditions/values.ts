/** A number, or a string that is one ("5", " 3.2 "). Anything else is null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * A moment in time (ms), from ISO text ("2026-01-31", "2026-01-31T09:00:00Z") or a number of milliseconds or seconds
 * since 1970 (values under 10^11 are read as seconds, as APIs such as Slack and Stripe send them). Null otherwise.
 */
export function toTime(value: unknown): number | null {
  const n = toNumber(value);
  if (n !== null) return n < 1e11 ? n * 1000 : n;
  if (typeof value !== "string") return null;
  const t = Date.parse(value.trim());
  return Number.isNaN(t) ? null : t;
}

/** How long a value is: characters of text, items of a list, keys of an object. Null for anything else. */
export function lengthOf(value: unknown): number | null {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return null;
}

/** Empty: missing, null, "", whitespace only, an empty list or an object with no keys. */
export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  const length = lengthOf(value);
  return length === 0;
}

/** Text for comparing, lower-cased unless the condition is case-sensitive. */
export const asText = (value: unknown, caseSensitive?: boolean) => {
  const text = value === undefined || value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return caseSensitive ? text.trim() : text.trim().toLowerCase();
};
