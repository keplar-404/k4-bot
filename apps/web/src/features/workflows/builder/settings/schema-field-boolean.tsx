"use client";

import { Switch } from "@/components/ui/switch";
import { Field } from "./field";
import type { JsonSchema } from "./tools-api";

export function SchemaFieldBoolean({
  id,
  label,
  required,
  hint,
  schema,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required: boolean;
  hint: string | undefined;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <Field id={id} label={label} required={required} hint={hint}>
        {null}
      </Field>
      <Switch
        id={id}
        checked={
          value === true || (value === undefined && schema.default === true)
        }
        onCheckedChange={(v) => onChange(v)}
      />
    </div>
  );
}
