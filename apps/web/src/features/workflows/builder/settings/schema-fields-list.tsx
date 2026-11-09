"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import type { JsonSchema } from "./tools-api";

/** A JSON Schema type in plain words. */
export function typeWords(schema: JsonSchema): string {
  const type = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null")
    : schema.type;
  if (type === "integer" || type === "number") return "number";
  if (type === "boolean") return "yes / no";
  if (type === "array") return "list";
  if (type === "object") return "object";
  return "text";
}

/**
 * The fields some data has (an event's payload, an action's output), each as the reference that reads it. Clicking
 * copies the reference to paste into a later block's field.
 */
export function SchemaFieldsList({
  schema,
  prefix,
}: {
  schema: JsonSchema;
  prefix: string;
}) {
  const fields = Object.entries(schema.properties ?? {});
  if (fields.length === 0)
    return (
      <p className="text-muted-foreground text-xs">
        Its fields are not described. Run it once and open Runs to see what it
        sends.
      </p>
    );
  return (
    <ul className="flex flex-col gap-1">
      {fields.map(([key, field]) => {
        const ref = `{{${prefix}.${key}}}`;
        return (
          <li key={key}>
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                void navigator.clipboard.writeText(ref);
                toast.success(`Copied ${ref}`);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <code className="truncate text-xs">{ref}</code>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {typeWords(field)}
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
