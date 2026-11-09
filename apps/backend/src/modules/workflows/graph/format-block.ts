import { z } from "zod";

/** Every Formatter operation, grouped by what it works on (the builder shows them in these groups). */
export const FORMAT_OPERATIONS = {
  text: ["uppercase", "lowercase", "capitalize", "trim", "replace", "split", "truncate", "extract_email", "extract_url", "extract_number"],
  number: ["round", "add", "subtract", "multiply", "divide", "format_number"],
  date: ["format_date", "add_time", "to_timezone"],
  list: ["join", "first", "last", "count", "unique"],
} as const;

export type FormatOperation = (typeof FORMAT_OPERATIONS)[keyof typeof FORMAT_OPERATIONS][number];
const ALL = Object.values(FORMAT_OPERATIONS).flat() as [FormatOperation, ...FormatOperation[]];

/**
 * Formatter (Zapier's Formatter): changes one value without code. `input` may hold {{references}}; `options` are the
 * operation's settings (find/replace text, a separator, decimals, a number, a time zone, a length…), all as text.
 * The result is {{steps.<id>.output.result}}.
 */
export const formatConfig = z.object({
  operation: z.enum(ALL).default("trim"),
  input: z.string().max(20_000).default(""),
  options: z.record(z.string().max(40), z.string().max(2000)).default({}),
});

export type FormatConfig = z.infer<typeof formatConfig>;
