"use client";

import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";
import type { JsonSchema } from "./tools-api";

export function SchemaFieldJson({
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
  const text =
    typeof value === "string"
      ? value
      : value === undefined
        ? ""
        : JSON.stringify(value, null, 2);
  return (
    <Field
      id={id}
      label={label}
      required={required}
      hint={`${hint ?? ""} JSON.`.trim()}
    >
      <Textarea
        id={id}
        rows={3}
        className="font-mono text-xs"
        value={text}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : e.target.value)
        }
      />
    </Field>
  );
}
