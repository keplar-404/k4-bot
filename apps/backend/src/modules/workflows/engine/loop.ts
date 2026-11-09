import { LOOP_LIMITS } from "../graph/flow-blocks";
import { FatalBlockError } from "./errors";

/** What a For each block outputs: the items it will go through (cut to `max`) and how many there were. */
export function listToLoop(value: unknown, max: number) {
  let list = value;
  // A list that arrived as text (a Set field, an HTTP text body) is read as JSON.
  if (typeof list === "string" && list.trim().startsWith("[")) {
    try {
      list = JSON.parse(list);
    } catch {
      // Falls through to the error below.
    }
  }
  if (!Array.isArray(list)) {
    throw new FatalBlockError("For each needs a list. Pick a field that holds a list (shown as “list” in the data).");
  }
  const items = list.slice(0, max);
  return { count: items.length, total: list.length, items };
}

/** Refuses a loop that would run more blocks than one run may (each block run is a durable step). */
export function checkLoopSize(items: number, bodySize: number) {
  if (items * bodySize > LOOP_LIMITS.blockRuns) {
    return `${items} items × ${bodySize} blocks is more than ${LOOP_LIMITS.blockRuns} block runs. Lower the For each limit or repeat fewer blocks.`;
  }
  return null;
}

