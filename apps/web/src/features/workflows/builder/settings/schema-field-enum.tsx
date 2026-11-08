"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "./field";
import type { JsonSchema } from "./tools-api";

export function SchemaFieldEnum({
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
    <Field id={id} label={label} required={required} hint={hint}>
      <Select
        value={value === undefined ? "" : String(value)}
        onValueChange={(v) => onChange(v === "" ? undefined : v)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {schema.enum!.map((o) => (
            <SelectItem key={String(o)} value={String(o)}>
              {String(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
