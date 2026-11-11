import { z } from "zod";
import { graphSchema, type WorkflowGraph } from "../workflows/graph/schema";
import { structureIssues } from "../workflows/graph/validate";

/** A block as the model writes it: no canvas position (kept or chosen here). */
export type DraftNode = {
  id: string;
  kind: string;
  label?: string;
  config?: Record<string, unknown>;
  retry?: Record<string, unknown>;
  onError?: "stop" | "continue";
};
export type DraftEdge = { source: string; target: string; branch?: string };

const ROW = 160;

/**
 * Turns the model's blocks and connections into a valid graph. Blocks already on the canvas keep their place (the user
 * arranged them); a new block goes under the block it follows, or under the lowest block. Returns the schema's message
 * when it is not valid, for the model to fix.
 */
export function buildGraph(prev: WorkflowGraph, nodes: DraftNode[], edges: DraftEdge[]): { graph: WorkflowGraph } | { error: string } {
  const placed = new Map(prev.nodes.map((n) => [n.id, n.position]));
  const lowest = () => Math.max(0, ...[...placed.values()].map((p) => p.y));
  const withPos = nodes.map((n) => {
    const kept = placed.get(n.id);
    if (kept) return { ...n, config: n.config ?? {}, position: kept };
    const from = edges.find((e) => e.target === n.id && placed.has(e.source));
    const anchor = from ? placed.get(from.source)! : { x: 0, y: lowest() };
    // Siblings under the same block are spread sideways so they do not overlap.
    const siblings = from ? edges.filter((e) => e.source === from.source && !prev.nodes.some((p) => p.id === e.target)).findIndex((e) => e.target === n.id) : 0;
    const position = { x: anchor.x + Math.max(0, siblings) * 280, y: anchor.y + ROW };
    placed.set(n.id, position);
    return { ...n, config: n.config ?? {}, position };
  });
  const withIds = edges.map((e) => ({ id: `e_${e.source}_${e.target}${e.branch ? `_${e.branch}` : ""}`.slice(0, 40), ...e }));
  const parsed = graphSchema.safeParse({ nodes: withPos, edges: withIds, ...(prev.pins ? { pins: prev.pins } : {}) });
  if (!parsed.success) return { error: z.prettifyError(parsed.error).slice(0, 1500) };
  const issue = structureIssues(parsed.data)[0];
  if (issue) return { error: issue.message };
  return { graph: parsed.data };
}

/** The graph as the model sees it: no positions, no pinned sample data. */
export function graphForModel(g: WorkflowGraph) {
  return {
    nodes: g.nodes.map(({ position: _p, ...n }) => n as DraftNode),
    edges: g.edges.map(({ id: _id, ...e }) => e as DraftEdge),
  };
}
