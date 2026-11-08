"use client";

import { blockTitle } from "../builder/block-label";
import { useBuilder } from "../builder/store";
import { useRunView } from "./run-view-store";

/** The viewed run's blocks in the order they ran; a click selects the block on the canvas. */
export function RunSteps() {
  const detail = useRunView((s) => s.detail);
  const nodes = useBuilder((s) => s.nodes);
  const select = useBuilder((s) => s.select);
  if (!detail)
    return <p className="p-3 text-muted-foreground text-xs">Loading…</p>;
  return (
    <ul className="flex flex-col gap-1 p-2">
      {detail.steps.map((s) => {
        const block = nodes.find((n) => n.id === s.nodeId)?.data.block;
        return (
          <li key={s.nodeId}>
            <button
              type="button"
              onClick={() => select(s.nodeId)}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted"
            >
              <span className="truncate">
                {block ? blockTitle(block) : s.nodeId}
              </span>
              <span
                className={
                  s.status === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {s.status}
                {s.attempt > 1 ? ` · try ${s.attempt}` : ""}
              </span>
            </button>
            {s.error && (
              <p className="px-2 pb-1 text-destructive text-xs">{s.error}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
