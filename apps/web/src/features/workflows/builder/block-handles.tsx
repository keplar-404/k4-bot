"use client";

import { Handle, Position } from "@xyflow/react";
import type { BlockBody } from "./blocks";

/**
 * The grab area is invisible and sized by the canvas (--handle-hit, about 20 screen pixels at any zoom); the dot
 * drawn inside stays small. A 10px dot alone is 5px on screen at 50% zoom and hard to catch.
 */
const handle =
  "!size-[var(--handle-hit,20px)] !border-0 !bg-transparent flex items-center justify-center after:pointer-events-none after:block after:size-2.5 after:rounded-full after:border-2 after:border-background after:bg-muted-foreground after:content-[''] hover:after:bg-primary";

/** A block's named outputs: If → true / false, Switch → one per rule and "otherwise". Others have one plain output. */
export function outputsOf(b: BlockBody): Array<{ id: string; label: string }> {
  if (b.kind === "logic.if") {
    return [
      { id: "true", label: "true" },
      { id: "false", label: "false" },
    ];
  }
  if (b.kind === "logic.switch") {
    return [
      ...b.config.rules.map((r) => ({ id: r.id, label: r.label || r.id })),
      ...(b.config.otherwise ? [{ id: "otherwise", label: "otherwise" }] : []),
    ];
  }
  if (b.kind === "logic.loop") {
    // The plain output (no id, so no branch) repeats per item; "done" runs once after all of them.
    return [
      { id: "", label: "each item" },
      { id: "done", label: "done" },
    ];
  }
  return [];
}

/** The source handles: the named outputs spread along the bottom with their labels, or one plain handle. */
export function BlockHandles({ block }: { block: BlockBody }) {
  const outputs = outputsOf(block);
  if (outputs.length === 0)
    return (
      <Handle type="source" position={Position.Bottom} className={handle} />
    );
  return (
    <>
      {outputs.map((o, i) => {
        const left = `${((i + 1) * 100) / (outputs.length + 1)}%`;
        return (
          <span key={o.id || "main"}>
            <Handle
              id={o.id || undefined}
              type="source"
              position={Position.Bottom}
              style={{ left }}
              className={handle}
            />
            <span
              className="pointer-events-none absolute -bottom-5 max-w-20 -translate-x-1/2 truncate text-[10px] text-muted-foreground"
              style={{ left }}
            >
              {o.label}
            </span>
          </span>
        );
      })}
    </>
  );
}

export { handle };
