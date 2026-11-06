"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type * as React from "react";
import { useTheme } from "next-themes";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
const initialNodes: Node[] = [
  { id: "1", position: { x: 100, y: 100 }, data: { label: "Start" } },
  { id: "2", position: { x: 350, y: 100 }, data: { label: "Step" } },
  { id: "3", position: { x: 600, y: 100 }, data: { label: "End" } },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3" },
];

export default function WorkflowPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const nodeTypes = useMemo(() => ({}), []);

  // Make React Flow follow the app's theme (shadcn tokens) instead of its
  // hard-coded light defaults, so nodes/controls/minimap read correctly in dark mode.
  const flowStyle = {
    "--xy-node-background-color-default": "var(--card)",
    "--xy-node-color-default": "var(--card-foreground)",
    "--xy-node-border-default": "1px solid var(--border)",
    "--xy-node-group-background-color-default": "var(--muted)",
    "--xy-edge-stroke-default": "var(--muted-foreground)",
    "--xy-connectionline-stroke-default": "var(--muted-foreground)",
    "--xy-handle-background-color-default": "var(--primary)",
    "--xy-handle-border-color-default": "var(--card)",
    "--xy-minimap-background-color-default": "var(--card)",
    "--xy-controls-button-background-color-default": "var(--card)",
    "--xy-controls-button-background-color-hover-default": "var(--accent)",
    "--xy-controls-button-color-default": "var(--card-foreground)",
    "--xy-controls-button-border-color-default": "var(--border)",
    "--xy-background-pattern-dots-color-default": "var(--muted-foreground)",
    "--xy-background-pattern-lines-color-default": "var(--border)",
    "--xy-selection-background-color-default": "color-mix(in oklab, var(--primary) 12%, transparent)",
    "--xy-selection-border-default": "1px dotted var(--primary)",
    "--xy-attribution-background-color-default": "var(--card)",
  } as React.CSSProperties;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Workflow</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Build and run node-based workflows. Drag nodes, connect handles, and
          inspect the graph.
        </p>
      </header>

      <div className="min-h-[60vh] flex-1 overflow-hidden rounded-lg border bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          colorMode={colorMode}
          style={flowStyle}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
