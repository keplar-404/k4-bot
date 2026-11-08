"use client";

import { Handle, Position } from "@xyflow/react";
import { cn } from "cn";

const handle = "!size-2.5 !border-2 !border-background !bg-muted-foreground";

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
