import type { Condition } from "../graph/schema";
import { resolve, type RunContext } from "./template";

const TRUE_WORDS = new Set(["true", "1", "yes"]);
const FALSE_WORDS = new Set(["false", "0", "no", ""]);

/** A number, or a string that is one ("5", " 3.2 "). Anything else is null. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

/** Equal as numbers when both are numbers, otherwise as trimmed text ("5" equals 5, true equals "true"). */
function equals(a: unknown, b: unknown): boolean {
  const x = toNumber(a);
  const y = toNumber(b);
  if (x !== null && y !== null) return x === y;
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function contains(haystack: unknown, needle: unknown): boolean {
  if (Array.isArray(haystack)) return haystack.some((item) => equals(item, needle));
  return String(haystack ?? "")
    .toLowerCase()
    .includes(String(needle ?? "").toLowerCase());
}

function exists(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  return !(Array.isArray(value) && value.length === 0);
}

function compare(op: "gt" | "gte" | "lt" | "lte", a: unknown, b: unknown): boolean {
  const x = toNumber(a);
  const y = toNumber(b);
  if (x === null || y === null) return false;
  if (op === "gt") return x > y;
  if (op === "gte") return x >= y;
  if (op === "lt") return x < y;
  return x <= y;
}

function check(condition: Condition, ctx: RunContext): boolean {
  const left = resolve(condition.left, ctx);
  const right = condition.right === undefined ? undefined : resolve(condition.right, ctx);

  switch (condition.op) {
    case "equals":
      return equals(left, right);
    case "not_equals":
      return !equals(left, right);
    case "contains":
      return contains(left, right);
    case "not_contains":
      return !contains(left, right);
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return compare(condition.op, left, right);
    case "exists":
      return exists(left);
    case "not_exists":
      return !exists(left);
    case "is_true":
      return left === true || TRUE_WORDS.has(String(left).toLowerCase());
    case "is_false":
      return left === false || left == null || FALSE_WORDS.has(String(left).toLowerCase());
  }
}

/** An If or Filter block's answer. No conditions means false: an empty block never lets a run through. */
export function evaluate(block: { combine: "all" | "any"; conditions: Condition[] }, ctx: RunContext): boolean {
  if (block.conditions.length === 0) return false;
  const results = block.conditions.map((condition) => check(condition, ctx));
  return block.combine === "all" ? results.every(Boolean) : results.some(Boolean);
}
