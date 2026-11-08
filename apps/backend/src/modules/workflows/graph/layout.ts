/**
 * Canvas positions for a graph that has none (a bot writes workflows without coordinates): a column per depth from the
 * trigger, a row per block in that column. Bounded passes, so a loop in a bad graph cannot hang it (validation reports it).
 */
export function withPositions<N extends { id: string }>(
  nodes: N[],
  edges: Array<{ source: string; target: string }>,
): Array<N & { position: { x: number; y: number } }> {
  const depth = new Map(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    for (const e of edges)
      if (depth.has(e.source) && depth.has(e.target))
        depth.set(e.target, Math.max(depth.get(e.target)!, depth.get(e.source)! + 1));
  }
  const rows = new Map<number, number>();
  return nodes.map((n) => {
    const x = depth.get(n.id)!;
    const y = rows.get(x) ?? 0;
    rows.set(x, y + 1);
    return { ...n, position: { x: x * 280, y: y * 140 } };
  });
}
