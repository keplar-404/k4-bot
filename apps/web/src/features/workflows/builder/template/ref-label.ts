import { blockTitle } from "../block-label";
import type { BlockBody } from "../blocks";

export type RefLabel = { source: string; field: string; broken: boolean };

/**
 * How a reference reads in a pill: where the data comes from (the block's name, the trigger, the loop item…) and which
 * field. `broken` when it names a block that is no longer on the canvas.
 */
export function refLabel(path: string, blocks: BlockBody[]): RefLabel {
  const parts = path.split(".");
  const rest = (from: number) => parts.slice(from).join(".") || "all of it";
  if (parts[0] === "steps") {
    const block = blocks.find((b) => b.id === parts[1]);
    // "steps.<id>.output.x" → field "x"; ".error" stays visible as "error".
    const from = parts[2] === "output" ? 3 : 2;
    return {
      source: block ? blockTitle(block) : `Missing block ${parts[1] ?? ""}`,
      field: rest(from),
      broken: !block,
    };
  }
  if (parts[0] === "trigger") {
    const from = ["data", "body", "inputs"].includes(parts[1] ?? "") ? 2 : 1;
    return { source: "Trigger", field: rest(from), broken: false };
  }
  if (parts[0] === "loop")
    return { source: "For each", field: rest(1), broken: false };
  if (parts[0] === "secrets")
    return { source: "Secret", field: rest(1), broken: false };
  if (parts[0] === "run")
    return { source: "Run", field: rest(1), broken: false };
  return { source: "Data", field: path, broken: false };
}
