import { FORMAT_OPERATIONS, type FormatConfig } from "../../graph/format-block";
import { resolve, type RunContext } from "../template";
import { formatDate, formatList, formatNumber } from "./number-date-list";
import { formatText } from "./text";

const textOf = (v: unknown) => (v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
const isIn = (group: readonly string[], op: string) => group.includes(op);

/** Runs a Formatter block: fills in its input, applies the operation, returns `{ result }`. */
export function runFormat(config: FormatConfig, ctx: RunContext): { result: unknown } {
  const input = resolve(config.input, ctx);
  const op = config.operation;
  const o = config.options;
  if (isIn(FORMAT_OPERATIONS.text, op)) return { result: formatText(op, textOf(input), o) };
  if (isIn(FORMAT_OPERATIONS.number, op)) return { result: formatNumber(op, input, o) };
  if (isIn(FORMAT_OPERATIONS.date, op)) return { result: formatDate(op, input, o) };
  return { result: formatList(op, input, o) };
}
