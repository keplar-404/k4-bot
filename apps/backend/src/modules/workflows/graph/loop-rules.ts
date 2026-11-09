import type { WorkflowGraph } from "./schema";
import type { GraphIssue } from "./structure";

/** Every block a run reaches after `start` (not `start` itself). */
export function descendants(g: WorkflowGraph, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const e of g.edges) {
      if (e.source !== id || seen.has(e.target)) continue;
      seen.add(e.target);
      stack.push(e.target);
    }
  }
  return seen;
}

/** Every block a run passes through before reaching `end` (not `end` itself). */
export function ancestors(g: WorkflowGraph, end: string): Set<string> {
  const seen = new Set<string>();
  const stack = [end];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const e of g.edges) {
      if (e.target !== id || seen.has(e.source)) continue;
      seen.add(e.source);
      stack.push(e.source);
    }
  }
  return seen;
}

/** The For each block's second output: what is connected there runs once, after every item. */
export const LOOP_DONE = "done";

/** `start` and every block after it. */
const reachedFrom = (g: WorkflowGraph, starts: string[]) => new Set(starts.flatMap((s) => [s, ...descendants(g, s)]));

/**
 * The workflow's For each block, the blocks it repeats (everything after its main output) and the blocks after its
 * "done" output (they run once, when every item is done), if it has one.
 */
export function loopOf(g: WorkflowGraph) {
  const loop = g.nodes.find((n) => n.kind === "logic.loop");
  if (loop?.kind !== "logic.loop") return null;
  const out = g.edges.filter((e) => e.source === loop.id);
  const body = reachedFrom(g, out.filter((e) => e.branch !== LOOP_DONE).map((e) => e.target));
  const after = reachedFrom(g, out.filter((e) => e.branch === LOOP_DONE).map((e) => e.target));
  return { loop, body, after };
}

/**
 * For each rules: one per workflow (a loop inside a loop multiplies runs past any sane limit), and something to
 * repeat after it.
 */
export function loopIssues(g: WorkflowGraph): GraphIssue[] {
  const loops = g.nodes.filter((n) => n.kind === "logic.loop");
  const issues = loops.slice(1).map((n) => ({ nodeId: n.id, message: "A workflow can have one For each block." }));
  const found = loopOf(g);
  if (found && found.body.size === 0) {
    issues.push({ nodeId: found.loop.id, message: "Connect the blocks to repeat for each item after this block." });
  }
  const both = found ? [...found.after].find((id) => found.body.has(id)) : undefined;
  if (both) issues.push({ nodeId: both, message: "A block can't be both repeated for each item and run after Done. Connect it to one of them." });
  return issues;
}
