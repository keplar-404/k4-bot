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

/** The workflow's For each block and the blocks it repeats (everything after it), if it has one. */
export function loopOf(g: WorkflowGraph) {
  const loop = g.nodes.find((n) => n.kind === "logic.loop");
  return loop?.kind === "logic.loop" ? { loop, body: descendants(g, loop.id) } : null;
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
  return issues;
}
