import { z } from "zod";

/**
 * Merge (n8n's Merge): brings 2-5 values together, usually the outputs of different paths. `append` joins lists
 * (a single value counts as one item), `combine` merges objects (later ones win), `by_key` joins two lists on a
 * field, `first` takes the first value that has something (the path that ran).
 */
export const MERGE_MODES = ["append", "combine", "by_key", "first"] as const;
export const mergeConfig = z.object({
  mode: z.enum(MERGE_MODES).default("append"),
  inputs: z.array(z.string().max(4000)).min(2).max(5).default(["", ""]),
  key: z.string().max(100).default(""),
});

/**
 * List tools (n8n's Split Out and Aggregate, Zapier's line items): one operation on a list. `field` is a property of
 * each item ("email", "address.city"); `amount` is how many for `first_n`.
 */
export const LIST_OPERATIONS = ["split_out", "pluck", "sum", "average", "min", "max", "count", "sort", "group_by", "unique", "first_n"] as const;
export const listConfig = z.object({
  operation: z.enum(LIST_OPERATIONS).default("pluck"),
  input: z.string().max(4000).default(""),
  field: z.string().max(100).default(""),
  order: z.enum(["asc", "desc"]).default("asc"),
  amount: z.number().int().min(1).max(1000).default(10),
});

export type MergeConfig = z.infer<typeof mergeConfig>;
export type ListConfig = z.infer<typeof listConfig>;
/** Operations that need `field`. */
export const NEEDS_FIELD = new Set<ListConfig["operation"]>(["split_out", "pluck", "group_by"]);
