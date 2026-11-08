import { addEdge, type Connection } from "@xyflow/react";
import { toast } from "sonner";
import { type BlockKind, newBlock, newBlockId } from "./blocks";
import type { FlowEdge, FlowNode } from "./flow";
import { connectionProblem, placeAfter } from "./flow-rules";

type Slice = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedId: string | null;
  version: number;
};
type Get = () => Slice;
type Set = (partial: Partial<Slice> | ((s: Slice) => Partial<Slice>)) => void;

/** A new edge, refused (with a toast) when it would loop, duplicate or lead into a trigger. */
export function connect(get: Get, set: Set, c: Connection) {
  const { nodes, edges } = get();
  const problem = connectionProblem(nodes, edges, c);
  if (problem) return void toast.error(problem);
  const branch =
    c.sourceHandle === "true" || c.sourceHandle === "false"
      ? c.sourceHandle
      : undefined;
  const edge: FlowEdge = {
    ...c,
    id: `e_${c.source}_${c.target}${branch ? `_${branch}` : ""}`,
    label: branch,
  };
  set((s) => ({ edges: addEdge(edge, s.edges), version: s.version + 1 }));
}

/** A block from the library: placed after the selected (or last) block and chained to it when that is safe. */
export function addBlockTo(
  get: Get,
  set: Set,
  kind: BlockKind,
  opts: { toolkit?: string; at?: { x: number; y: number } },
) {
  const { nodes, edges, selectedId } = get();
  if (
    kind.startsWith("trigger.") &&
    nodes.some((n) => n.data.block.kind.startsWith("trigger."))
  ) {
    return void toast.error(
      "A workflow has one trigger. Change the existing trigger in its settings instead.",
    );
  }
  const id = newBlockId(kind, opts.toolkit, new Set(nodes.map((n) => n.id)));
  const anchor = selectedId ?? nodes.at(-1)?.id ?? null;
  const { position, ...block } = newBlock(
    kind,
    opts.at ?? placeAfter(nodes, anchor),
    id,
    opts.toolkit,
  );
  const node: FlowNode = {
    id,
    type: "block",
    position,
    data: { block },
    selected: true,
  };
  const anchorNode = nodes.find((n) => n.id === anchor);
  // Added from the library (not dropped at a spot): chained after the anchor, unless that is an If (pick a branch).
  const link =
    !opts.at &&
    anchorNode &&
    anchorNode.data.block.kind !== "logic.if" &&
    !kind.startsWith("trigger.");
  set({
    nodes: [...nodes.map((n) => ({ ...n, selected: false })), node],
    edges: link
      ? [...edges, { id: `e_${anchor}_${id}`, source: anchor!, target: id }]
      : edges,
    selectedId: id,
    version: get().version + 1,
  });
}
