import type { Condition } from "../../graph/schema";
import { resolve, type RunContext } from "../template";
import { asText, isEmpty, lengthOf, toNumber, toTime } from "./values";

const TRUE_WORDS = new Set(["true", "1", "yes"]);
const FALSE_WORDS = new Set(["false", "0", "no", ""]);

/** Equal as numbers when both are numbers, otherwise as trimmed text ("5" equals 5, true equals "true"). */
function equals(a: unknown, b: unknown, caseSensitive?: boolean): boolean {
  const x = toNumber(a);
  const y = toNumber(b);
  if (x !== null && y !== null) return x === y;
  return asText(a, caseSensitive) === asText(b, caseSensitive);
}

function contains(haystack: unknown, needle: unknown, caseSensitive?: boolean): boolean {
  if (Array.isArray(haystack)) return haystack.some((item) => equals(item, needle, caseSensitive));
  return asText(haystack, caseSensitive).includes(asText(needle, caseSensitive));
}

function exists(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  return !(Array.isArray(value) && value.length === 0);
}

/** Ordered comparison of two numbers (null when either is not one, so the condition is false). */
function order(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a - b;
}

function check(c: Condition, ctx: RunContext): boolean {
  const left = resolve(c.left, ctx);
  const right = c.right === undefined ? undefined : resolve(c.right, ctx);
  const cs = c.caseSensitive;
  const numbers = order(toNumber(left), toNumber(right));
  const length = order(lengthOf(left), toNumber(right));
  const time = order(toTime(left), toTime(right));

  switch (c.op) {
    case "equals":
      return equals(left, right, cs);
    case "not_equals":
      return !equals(left, right, cs);
    case "contains":
      return contains(left, right, cs);
    case "not_contains":
      return !contains(left, right, cs);
    case "gt":
      return numbers !== null && numbers > 0;
    case "gte":
      return numbers !== null && numbers >= 0;
    case "lt":
      return numbers !== null && numbers < 0;
    case "lte":
      return numbers !== null && numbers <= 0;
    case "exists":
      return exists(left);
    case "not_exists":
      return !exists(left);
    case "is_true":
      return left === true || TRUE_WORDS.has(String(left).toLowerCase());
    case "is_false":
      return left === false || left == null || FALSE_WORDS.has(String(left).toLowerCase());
    case "starts_with":
      return asText(left, cs).startsWith(asText(right, cs));
    case "not_starts_with":
      return !asText(left, cs).startsWith(asText(right, cs));
    case "ends_with":
      return asText(left, cs).endsWith(asText(right, cs));
    case "not_ends_with":
      return !asText(left, cs).endsWith(asText(right, cs));
    case "is_empty":
      return isEmpty(left);
    case "is_not_empty":
      return !isEmpty(left);
    case "length_equals":
      return length === 0;
    case "length_gt":
      return length !== null && length > 0;
    case "length_lt":
      return length !== null && length < 0;
    case "date_before":
      return time !== null && time < 0;
    case "date_after":
      return time !== null && time > 0;
    case "date_equals":
      // Same calendar day (UTC): "is on 2026-01-31" should match any time that day.
      return time !== null && Math.floor((toTime(left) ?? 0) / 864e5) === Math.floor((toTime(right) ?? 0) / 864e5);
  }
}

type Group = { combine: "all" | "any"; conditions: Condition[] };

/**
 * An If or Filter block's answer (or a Switch rule's). Each group counts as one more result. No conditions at all
 * means false: an empty block never lets a run through. An empty group is left out.
 */
export function evaluate(block: Group & { groups?: Group[] }, ctx: RunContext): boolean {
  const results = [
    ...block.conditions.map((condition) => check(condition, ctx)),
    ...(block.groups ?? []).filter((g) => g.conditions.length > 0).map((g) => evaluate(g, ctx)),
  ];
  if (results.length === 0) return false;
  return block.combine === "all" ? results.every(Boolean) : results.some(Boolean);
}
