"use client";

import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";
import type { JsonSchema } from "./tools-api";

export function SchemaFieldArray({
  id,
  label,
  required,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required: boolean;
  hint: string | undefined;
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
