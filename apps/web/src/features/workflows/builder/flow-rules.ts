import type { FlowEdge, FlowNode } from "./flow";

/** Whether adding source → target would close a loop (target already leads back to source). */
export function wouldLoop(
  edges: FlowEdge[],
  source: string,
  target: string,
): boolean {
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === source) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of edges) if (e.source === id) stack.push(e.target);
  }
  return false;
}

/** Why a connection is refused (shown to the user), or null when it is fine. Mirrors the server's rules. */
export function connectionProblem(
  nodes: FlowNode[],
  edges: FlowEdge[],
  c: { source: string; target: string; sourceHandle?: string | null },
): string | null {
  if (c.source === c.target) return "A block cannot connect to itself.";
  const target = nodes.find((n) => n.id === c.target);
  if (target?.data.block.kind.startsWith("trigger."))
    return "Nothing can lead into a trigger.";
  if (
    edges.some(
      (e) =>
        e.source === c.source &&
        e.target === c.target &&
        (e.sourceHandle ?? null) === (c.sourceHandle ?? null),
    )
  ) {
    return "These blocks are already connected.";
  }
  if (wouldLoop(edges, c.source, c.target))
    return "That would make a loop. Workflows run forward only.";
  return null;
}

/** Where to put a block added from the library: under the selected (or last) block, else at the origin. */
export function placeAfter(
  nodes: FlowNode[],
  anchorId: string | null,
): { x: number; y: number } {
  const anchor = nodes.find((n) => n.id === anchorId) ?? nodes.at(-1);
  if (!anchor) return { x: 0, y: 0 };
  return { x: anchor.position.x, y: anchor.position.y + 140 };
}
