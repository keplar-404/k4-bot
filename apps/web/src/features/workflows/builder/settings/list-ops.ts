import type { BlockBody } from "../blocks";

type Op = Extract<BlockBody, { kind: "logic.list" }>["config"]["operation"];

/** Each operation: its label, whether it needs a field (optional ones say so) and what it outputs. */
export const LIST_OPS: Array<{
  op: Op;
  label: string;
  field?: "required" | "optional";
  out: string;
}> = [
  {
    op: "split_out",
    label: "Split out a list field",
    field: "required",
    out: "items: every item's list, as one list",
  },
  {
    op: "pluck",
    label: "Pick one field from each item",
    field: "required",
    out: "items: that field of each item",
  },
  { op: "count", label: "Count items", out: "result: how many" },
  { op: "sum", label: "Sum", field: "optional", out: "result: the total" },
  {
    op: "average",
    label: "Average",
    field: "optional",
    out: "result: the average",
  },
  {
    op: "min",
    label: "Smallest",
    field: "optional",
    out: "result: the smallest number",
  },
  {
    op: "max",
    label: "Largest",
    field: "optional",
    out: "result: the largest number",
  },
  { op: "sort", label: "Sort", field: "optional", out: "items: sorted" },
  {
    op: "group_by",
    label: "Group by a field",
    field: "required",
    out: "result: { value: [items] }",
  },
  {
    op: "unique",
    label: "Remove duplicates",
    field: "optional",
    out: "items: without repeats",
  },
  { op: "first_n", label: "Keep the first N", out: "items: the first N" },
];
