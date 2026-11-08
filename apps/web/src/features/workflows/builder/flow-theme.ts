import type * as React from "react";

/**
 * React Flow's own colours replaced by the app's shadcn tokens, so nodes, edges, controls and the minimap follow the
 * light and dark themes instead of React Flow's built-in light defaults (the base styles are imported in
 * globals.css, in the base layer, so these and Tailwind win).
 */
export const flowTheme = {
  "--xy-node-background-color-default": "var(--card)",
  "--xy-node-color-default": "var(--card-foreground)",
  "--xy-node-border-default": "1px solid var(--border)",
  "--xy-node-group-background-color-default": "var(--muted)",
  "--xy-edge-stroke-default": "var(--muted-foreground)",
  "--xy-edge-stroke-selected-default": "var(--foreground)",
  "--xy-edge-label-background-color-default": "var(--background)",
  "--xy-edge-label-color-default": "var(--muted-foreground)",
  "--xy-connectionline-stroke-default": "var(--muted-foreground)",
  "--xy-handle-background-color-default": "var(--primary)",
  "--xy-handle-border-color-default": "var(--card)",
  "--xy-minimap-background-color-default": "var(--card)",
  "--xy-controls-button-background-color-default": "var(--card)",
  "--xy-controls-button-background-color-hover-default": "var(--accent)",
  "--xy-controls-button-color-default": "var(--card-foreground)",
  "--xy-controls-button-border-color-default": "var(--border)",
  "--xy-background-pattern-dots-color-default":
    "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
  "--xy-selection-background-color-default":
    "color-mix(in oklab, var(--primary) 12%, transparent)",
  "--xy-selection-border-default": "1px dotted var(--primary)",
  "--xy-attribution-background-color-default": "transparent",
} as React.CSSProperties;

/** Drag-and-drop from the block library: what is being dropped. */
export const DRAG_TYPE = "application/x-k4-block";
export type DragPayload = { kind: string; toolkit?: string };
