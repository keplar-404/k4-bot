"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";
import type { JsonSchema } from "./tools-api";

export function SchemaFieldText({
  id,
  name,
  label,
  required,
  hint,
  schema,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  required: boolean;
  hint: string | undefined;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const LONG =
    /body|content|message|text|description|html|markdown|query|prompt/i;
  const example = (s: JsonSchema) =>
    s.examples?.[0] !== undefined && typeof s.examples[0] !== "object"
      ? String(s.examples[0])
      : undefined;
  const Control = LONG.test(name) ? Textarea : Input;
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      <Control
        id={id}
        value={value === undefined ? "" : String(value)}
        placeholder={
          example(schema) ??
          (schema.default !== undefined ? String(schema.default) : undefined)
        }
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : e.target.value)
        }
      />
    </Field>
  );
}
