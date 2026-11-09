"use client";

import { CopyIcon, GripVerticalIcon } from "lucide-react";
import { toast } from "sonner";
import { fieldsOf, REF_DRAG_TYPE } from "../template/block-fields";
import type { JsonSchema } from "./tools-api";

export { typeWords } from "../template/block-fields";

/**
 * The fields some data has (an event's payload, an action's output). Drag one onto a field of a later block to use
 * it there, or click to copy its reference.
 */
export function SchemaFieldsList({
  schema,
  prefix,
}: {
  schema: JsonSchema;
  prefix: string;
}) {
  const fields = fieldsOf(schema, prefix);
  if (fields.length === 0)
    return (
      <p className="text-muted-foreground text-xs">
        Its fields are not described. Run it once and open Runs to see what it
        sends.
      </p>
    );
  return (
    <ul className="flex flex-col gap-1">
      {fields.map((field) => {
        const ref = `{{${field.path}}}`;
        return (
          <li key={field.path}>
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(REF_DRAG_TYPE, field.path);
                // Plain text too, so dropping into any other input still gives the reference.
                e.dataTransfer.setData("text/plain", ref);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="flex w-full cursor-grab items-start gap-1.5 rounded-md border px-2 py-1.5 text-left hover:bg-muted active:cursor-grabbing"
              title="Drag onto a field, or click to copy"
              onClick={() => {
                void navigator.clipboard.writeText(ref);
                toast.success(`Copied ${ref}`);
              }}
            >
              <GripVerticalIcon
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-xs">
                    {field.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {field.type}
                  </span>
                </span>
                {field.description && (
                  <span className="line-clamp-2 text-[11px] text-muted-foreground">
                    {field.description}
                  </span>
                )}
              </span>
              <CopyIcon
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
