import type { BlockBody } from "../blocks";

type CondBlock = Extract<BlockBody, { kind: "logic.if" | "logic.filter" }>;
export type Cond = CondBlock["config"]["conditions"][number];

/** Comparisons grouped like n8n's: by the kind of value being checked. */
export const OP_GROUPS: Array<{
  group: string;
  ops: Array<[Cond["op"], string]>;
}> = [
  {
    group: "Any value",
    ops: [
      ["equals", "equals"],
      ["not_equals", "does not equal"],
      ["exists", "has a value"],
      ["not_exists", "has no value"],
      ["is_empty", "is empty"],
      ["is_not_empty", "is not empty"],
    ],
  },
  {
    group: "Text",
    ops: [
      ["contains", "contains"],
      ["not_contains", "does not contain"],
      ["starts_with", "starts with"],
      ["not_starts_with", "does not start with"],
      ["ends_with", "ends with"],
      ["not_ends_with", "does not end with"],
    ],
  },
  {
    group: "Number",
    ops: [
      ["gt", "is greater than"],
      ["gte", "is at least"],
      ["lt", "is less than"],
      ["lte", "is at most"],
    ],
  },
  {
    group: "Date & time",
    ops: [
      ["date_after", "is after"],
      ["date_before", "is before"],
      ["date_equals", "is on the day"],
    ],
  },
  {
    group: "List (or text length)",
    ops: [
      ["length_equals", "length is"],
      ["length_gt", "length is more than"],
      ["length_lt", "length is less than"],
    ],
  },
  {
    group: "Yes / no",
    ops: [
      ["is_true", "is true"],
      ["is_false", "is false"],
    ],
  },
];

export const OPS: Array<[Cond["op"], string]> = OP_GROUPS.flatMap((g) => g.ops);

/** Comparisons that need no second value. */
export const UNARY = new Set<Cond["op"]>([
  "exists",
  "not_exists",
  "is_true",
  "is_false",
  "is_empty",
  "is_not_empty",
]);

/** Comparisons on text, where case may matter. */
export const TEXTUAL = new Set<Cond["op"]>([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "not_starts_with",
  "ends_with",
  "not_ends_with",
]);

/** A hint in the second field for the chosen comparison. */
export const RIGHT_PLACEHOLDER: Partial<Record<Cond["op"], string>> = {
  date_after: "2026-01-31 or a date from earlier data",
  date_before: "2026-01-31 or a date from earlier data",
  date_equals: "2026-01-31",
  length_equals: "3",
  length_gt: "0",
  length_lt: "10",
  gt: "10",
  gte: "10",
  lt: "10",
  lte: "10",
};
