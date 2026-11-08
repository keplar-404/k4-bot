"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { type DragEvent, useEffect, useState } from "react";
import { nodeTypes } from "./block-node";
import type { BlockKind } from "./blocks";
import { connectionProblem } from "./flow-rules";
import { DRAG_TYPE, type DragPayload, flowTheme } from "./flow-theme";
import { useBuilder } from "./store";

const EDGE = { type: "smoothstep", style: { strokeWidth: 1.5 } } as const;

/**
 * The workflow canvas. Blocks come from the library (click or drag); connections are checked as they are drawn
 * (no loops, nothing into a trigger) with the same rules the server applies on save.
 */
export function Canvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    select,
    addBlock,
  } = useBuilder();
  const { screenToFlowPosition } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    const { kind, toolkit } = JSON.parse(raw) as DragPayload;
    const at = screenToFlowPosition({ x: e.clientX - 120, y: e.clientY - 30 });
    addBlock(kind as BlockKind, { toolkit, at });
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={EDGE}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={(c) => connectionProblem(nodes, edges, c) === null}
      onSelectionChange={({ nodes: sel }) =>
        select(sel.length === 1 ? sel[0]!.id : null)
      }
      onPaneClick={() => select(null)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={onDrop}
      deleteKeyCode={["Backspace", "Delete"]}
      colorMode={mounted && resolvedTheme === "dark" ? "dark" : "light"}
      style={flowTheme}
      fitView
      fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
      minZoom={0.25}
      maxZoom={1.75}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
      <Controls
        position="bottom-right"
        showInteractive={false}
        className="!rounded-lg !border !shadow-sm overflow-hidden"
      />
    </ReactFlow>
  );
}
