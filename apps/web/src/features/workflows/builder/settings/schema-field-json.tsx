"use client";

import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";

export function SchemaFieldJson({
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
      meta={meta}
      hint={`${hint ?? ""} JSON.`.trim()}
    >
      <Textarea
        placeholder={'e.g. { "label": "urgent" }'}
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
