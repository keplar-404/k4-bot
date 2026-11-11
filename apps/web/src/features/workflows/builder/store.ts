"use client";

import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import type { Workflow } from "../api";
import type { BlockBody, BlockKind } from "./blocks";
import { type FlowEdge, type FlowNode, graphToFlow } from "./flow";
import { addBlockTo, connect } from "./store-actions";

type State = {
  workflow: Workflow | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedId: string | null;
  /** Pinned sample outputs by block id: test runs use them instead of running those blocks. Saved with the draft. */
  pins: Record<string, unknown>;
  setPin: (id: string, output: unknown | undefined) => void;
  /** The server has the latest draft (set by the autosave). */
  saved: boolean;
  /** Bumped by every change that must be saved (not by selection or measuring). */
  version: number;
  /** The assistant run editing this workflow: the canvas is read-only and nothing is autosaved meanwhile. */
  lockedBy: string | null;
  /** Blocks the assistant just added: highlighted for a moment and brought into view (assistant/follow.tsx). */
  fresh: string[];
  /** The draft as the server has it now (the assistant changed it): keeps the selection when the block still exists. */
  reload: (w: Workflow) => void;
  load: (w: Workflow) => void;
  setWorkflow: (w: Workflow) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  select: (id: string | null) => void;
  addBlock: (
    kind: BlockKind,
    opts?: { toolkit?: string; at?: { x: number; y: number } },
  ) => void;
  updateBlock: (id: string, patch: (b: BlockBody) => BlockBody) => void;
  removeBlock: (id: string) => void;
};

/** Changes that alter what is saved: moving (on drop), adding, removing. Selecting and measuring do not. */
const saves = (c: { type: string; dragging?: boolean }) =>
  c.type === "remove" ||
  c.type === "add" ||
  (c.type === "position" && c.dragging === false);

/** The builder's state: the canvas (React Flow's nodes and edges) is the source of truth while editing. */
export const useBuilder = create<State>((set, get) => ({
  workflow: null,
  nodes: [],
  edges: [],
  selectedId: null,
  pins: {},
  saved: true,
  version: 0,
  lockedBy: null,
  fresh: [],
  load: (w) =>
    set({
      workflow: w,
      ...graphToFlow(w.graph),
      pins: w.graph.pins ?? {},
      selectedId: null,
      version: 0,
      lockedBy: w.assistantRunId ?? null,
    }),
  reload: (w) =>
    set((s) => {
      const flow = graphToFlow(w.graph);
      const keep = flow.nodes.some((n) => n.id === s.selectedId)
        ? s.selectedId
        : null;
      const known = new Set(s.nodes.map((n) => n.id));
      return {
        workflow: w,
        ...flow,
        fresh: flow.nodes.filter((n) => !known.has(n.id)).map((n) => n.id),
        nodes: flow.nodes.map((n) => ({ ...n, selected: n.id === keep })),
        pins: w.graph.pins ?? {},
        selectedId: keep,
      };
    }),
  setPin: (id, output) =>
    set((s) => {
      const { [id]: _old, ...rest } = s.pins;
      return {
        pins: output === undefined ? rest : { ...rest, [id]: output },
        version: s.version + 1,
      };
    }),
  setWorkflow: (w) => set({ workflow: w }),
  onNodesChange: (changes) =>
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes),
      version: changes.some(saves) ? s.version + 1 : s.version,
    })),
  onEdgesChange: (changes) =>
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges),
      version: changes.some(saves) ? s.version + 1 : s.version,
    })),
  onConnect: (c) => !get().lockedBy && connect(get, set, c),
  select: (id) => set({ selectedId: id }),
  addBlock: (kind, opts = {}) => {
    if (!get().lockedBy) addBlockTo(get, set, kind, opts);
  },
  updateBlock: (id, patch) =>
    set((s) =>
      s.lockedBy
        ? {}
        : {
            nodes: s.nodes.map((n) =>
              n.id === id ? { ...n, data: { block: patch(n.data.block) } } : n,
            ),
            version: s.version + 1,
          },
    ),
  removeBlock: (id) =>
    set((s) =>
      s.lockedBy
        ? {}
        : {
            nodes: s.nodes.filter((n) => n.id !== id),
            edges: s.edges.filter((e) => e.source !== id && e.target !== id),
            pins: Object.fromEntries(
              Object.entries(s.pins).filter(([k]) => k !== id),
            ),
            selectedId: s.selectedId === id ? null : s.selectedId,
            version: s.version + 1,
          },
    ),
}));
