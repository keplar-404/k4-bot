"use client";

import { ChevronRightIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SchemaField } from "./schema-field";
import type { JsonSchema } from "./tools-api";

type Args = Record<string, unknown>;

/** The action's inputs: required ones first, the optional ones folded away (most actions have many). */
export function SchemaForm({
  schema,
  value,
  onChange,
}: {
  schema: JsonSchema;
  value: Args;
  onChange: (next: Args) => void;
}) {
  const props = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);
  const set = (key: string, v: unknown) => {
    const next = { ...value };
    if (v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  const field = ([key, s]: [string, JsonSchema]) => (
    <SchemaField
      key={key}
      name={key}
      schema={s}
      required={required.has(key)}
      value={value[key]}
      onChange={(v) => set(key, v)}
    />
  );
  const must = props.filter(([k]) => required.has(k));
  const optional = props.filter(([k]) => !required.has(k));
  if (props.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        This action takes no input.
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      {must.map(field)}
      {optional.length > 0 && (
        <Collapsible
          defaultOpen={
            must.length === 0 || optional.some(([k]) => value[k] !== undefined)
          }
        >
          <CollapsibleTrigger className="group flex w-full items-center gap-1 font-medium text-muted-foreground text-xs hover:text-foreground">
            <ChevronRightIcon className="size-3.5 transition-transform group-data-panel-open:rotate-90" />
            Optional fields ({optional.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 flex flex-col gap-4">
            {optional.map(field)}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
