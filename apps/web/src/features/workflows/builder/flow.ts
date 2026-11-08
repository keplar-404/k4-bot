import type { Edge, Node } from "@xyflow/react";
import type { WorkflowGraph } from "../api";
import type { Block, BlockBody } from "./blocks";

/** What a canvas node carries: the saved block without its position (React Flow owns that). */
export type BlockData = { block: BlockBody };
export type FlowNode = Node<BlockData, "block">;
export type FlowEdge = Edge;

export function graphToFlow(g: WorkflowGraph): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  return {
    nodes: g.nodes.map(({ position, ...block }) => ({
      id: block.id,
      type: "block",
      position,
      data: { block },
    })),
    edges: g.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.branch ?? null,
      label: e.branch,
    })),
  };
}

export function flowToGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
): WorkflowGraph {
  return {
    nodes: nodes.map(
      (n) =>
        ({
          ...n.data.block,
          position: {
            x: Math.round(n.position.x),
            y: Math.round(n.position.y),
          },
        }) as Block,
    ),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle === "true" || e.sourceHandle === "false"
        ? { branch: e.sourceHandle }
        : {}),
    })),
  };
}
