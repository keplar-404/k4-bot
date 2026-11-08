"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { blockTitle } from "../block-label";
import { useBuilder } from "../store";

/** Blocks that run before `id` (everything that leads to it), nearest first. */
function upstream(
  id: string,
  edges: Array<{ source: string; target: string }>,
): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of edges)
      if (e.target === cur && !out.includes(e.source))
        out.push(e.source), stack.push(e.source);
  }
  return out;
}

/**
 * What a setting can refer to: the trigger's data and each earlier step's output. Clicking copies the reference to
 * paste into any field; it is filled in when the run reaches this block.
 */
export function DataReferences({ id }: { id: string }) {
  const { nodes, edges } = useBuilder();
  const refs = upstream(id, edges)
    .map((nid) => nodes.find((n) => n.id === nid))
    .filter((n) => n !== undefined)
    .map((n) => {
      const b = n.data.block;
      const ref = b.kind.startsWith("trigger.")
        ? "{{trigger}}"
        : `{{steps.${b.id}.output}}`;
      return { key: b.id, label: blockTitle(b), ref };
    });
  if (refs.length === 0)
    return (
      <p className="text-muted-foreground text-xs">
        Connect this block after another one to use its data.
      </p>
    );
  return (
    <ul className="flex flex-col gap-1">
      {refs.map((r) => (
        <li key={r.key}>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-muted"
            onClick={() => {
              void navigator.clipboard.writeText(r.ref);
              toast.success(`Copied ${r.ref}`);
            }}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs">{r.label}</span>
              <code className="block truncate text-[11px] text-muted-foreground">
                {r.ref}
              </code>
            </span>
            <CopyIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
        </li>
      ))}
      <li className="pt-1 text-[11px] text-muted-foreground">
        Add a path to reach inside, e.g. <code>{"{{steps.x.output.id}}"}</code>{" "}
        or <code>{"{{trigger.body.email}}"}</code>.
      </li>
    </ul>
  );
}
