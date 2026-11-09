"use client";

import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";

export function SchemaFieldArray({
  id,
  label,
  required,
  hint,
  meta,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required: boolean;
  hint: string | undefined;
  meta?: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const lines = Array.isArray(value)
    ? value.join("\n")
    : typeof value === "string"
      ? value
      : "";
  return (
    <Field
      id={id}
      label={label}
      required={required}
      meta={meta}
      hint={`${hint ?? ""} One per line.`.trim()}
    >
      <Textarea
        id={id}
        rows={2}
        value={lines}
        onChange={(e) =>
          onChange(
            e.target.value === "" ? undefined : e.target.value.split("\n"),
          )
        }
      />
    </Field>
  );
}
