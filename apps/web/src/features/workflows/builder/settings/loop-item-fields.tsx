"use client";

import { toast } from "sonner";

const FIELDS = [
  ["loop.item", "The current item (add .field for one of its fields)"],
  ["loop.index", "Its position: 0, 1, 2…"],
  ["loop.count", "How many items there are"],
] as const;

/** Inside a For each: the current item's references, click to copy. */
export function LoopItemFields() {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
      <p className="mb-1 font-medium text-xs">For each item</p>
      {FIELDS.map(([path, what]) => (
        <button
          key={path}
          type="button"
          className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
          onClick={() => {
            void navigator.clipboard.writeText(`{{${path}}}`);
            toast.success(`Copied {{${path}}}`);
          }}
        >
          <code className="shrink-0 text-[11px]">{`{{${path}}}`}</code>
          <span className="truncate text-[11px] text-muted-foreground">
            {what}
          </span>
        </button>
      ))}
    </div>
  );
}
