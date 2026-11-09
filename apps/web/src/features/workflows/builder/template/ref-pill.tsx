"use client";

import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useBuilder } from "../store";
import { refLabel } from "./ref-label";

/** A reference as a pill: "Gmail · subject"; red when its block was deleted. The full path is in the tooltip. */
export function RefPill({ node, selected }: NodeViewProps) {
  const path = String(node.attrs.path ?? "");
  const nodes = useBuilder((s) => s.nodes);
  const label = refLabel(
    path,
    nodes.map((n) => n.data.block),
  );
  return (
    <NodeViewWrapper
      as="span"
      title={`{{${path}}}`}
      className={`mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-px align-baseline text-xs leading-5 ${
        label.broken
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-primary/30 bg-primary/10 text-foreground"
      } ${selected ? "ring-2 ring-ring" : ""}`}
    >
      <span className="truncate text-muted-foreground">{label.source}</span>
      <span aria-hidden>·</span>
      <span className="truncate font-medium">{label.field}</span>
    </NodeViewWrapper>
  );
}
