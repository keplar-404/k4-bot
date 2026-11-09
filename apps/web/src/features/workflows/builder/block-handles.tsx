"use client";

import { Handle, Position } from "@xyflow/react";

/**
 * The grab area is invisible and sized by the canvas (--handle-hit, about 20 screen pixels at any zoom); the dot
 * drawn inside stays small. A 10px dot alone is 5px on screen at 50% zoom and hard to catch.
 */
const handle =
  "!size-[var(--handle-hit,20px)] !border-0 !bg-transparent flex items-center justify-center after:pointer-events-none after:block after:size-2.5 after:rounded-full after:border-2 after:border-background after:bg-muted-foreground after:content-[''] hover:after:bg-primary";

/** The source handles for a block: two labelled handles for an If, one otherwise. */
export function BlockHandles({ isIf }: { isIf: boolean }) {
  if (isIf) {
    return (
      <>
        <Handle
          id="true"
          type="source"
          position={Position.Bottom}
          style={{ left: "30%" }}
          className={handle}
        />
        <Handle
          id="false"
          type="source"
          position={Position.Bottom}
          style={{ left: "70%" }}
          className={handle}
        />
        <span className="pointer-events-none absolute -bottom-5 left-[30%] -translate-x-1/2 text-[10px] text-muted-foreground">
          true
        </span>
        <span className="pointer-events-none absolute -bottom-5 left-[70%] -translate-x-1/2 text-[10px] text-muted-foreground">
          false
        </span>
      </>
    );
  }
  return <Handle type="source" position={Position.Bottom} className={handle} />;
}

export { handle };
