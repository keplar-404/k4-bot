"use client";

import { useBuilder } from "../store";
import { LoopItemFields } from "./loop-item-fields";
import { UpstreamBlock } from "./upstream-block";

/** Blocks that run before `id` (everything that leads to it), nearest first. */
function upstream(
  id: string,
  edges: Array<{ source: string; target: string }>,
): string[] {
  const found: string[] = [];
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const e of edges) {
      if (e.target !== current || found.includes(e.source)) continue;
      found.push(e.source);
      stack.push(e.source);
    }
  }
  return found;
}

/**
 * What a setting can use: the trigger's data and each earlier step's output, field by field with its type and meaning.
 * Clicking a field copies its reference; it is filled in when the run reaches this block.
 */
export function DataReferences({ id }: { id: string }) {
  const { nodes, edges } = useBuilder();
  const blocks = upstream(id, edges)
    .map((nid) => nodes.find((n) => n.id === nid)?.data.block)
    .filter((b) => b !== undefined);
  if (blocks.length === 0)
    return (
      <p className="text-muted-foreground text-xs">
        Connect this block after another one to use its data.
      </p>
    );
  const inLoop = blocks.some((b) => b.kind === "logic.loop");
  return (
    <div className="flex flex-col gap-1">
      {inLoop && <LoopItemFields />}
      {blocks.map((b) => (
        <UpstreamBlock key={b.id} block={b} />
      ))}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Numbers, yes/no and lists are converted to what the next app expects.
        Reach deeper with a path, e.g.{" "}
        <code>{"{{steps.x.output.items.0.id}}"}</code>.
      </p>
    </div>
  );
}
