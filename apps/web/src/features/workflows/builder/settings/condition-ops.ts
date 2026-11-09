import type { BlockBody } from "../blocks";

type CondBlock = Extract<BlockBody, { kind: "logic.if" | "logic.filter" }>;
export type Cond = CondBlock["config"]["conditions"][number];

export const OPS: Array<[Cond["op"], string]> = [
  ["equals", "equals"],
  ["not_equals", "does not equal"],
  ["contains", "contains"],
  ["not_contains", "does not contain"],
  ["gt", "is greater than"],
  ["gte", "is at least"],
  ["lt", "is less than"],
  ["lte", "is at most"],
  ["exists", "has a value"],
  ["not_exists", "is empty"],
  ["is_true", "is true"],
  ["is_false", "is false"],
];

export const UNARY = new Set<Cond["op"]>([
  "exists",
  "not_exists",
  "is_true",
  "is_false",
]);
