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
  meta,
  schema,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  required: boolean;
  hint: string | undefined;
  meta?: string;
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
    <Field id={id} label={label} required={required} meta={meta} hint={hint}>
      <Control
        id={id}
        value={value === undefined ? "" : String(value)}
        // The grey text is what the field does when left empty, so it shows the default; an example only fills in
        // when there is none (an example such as "10" next to a default of 1 would promise a value that is not used).
        placeholder={
          schema.default !== undefined && schema.default !== ""
            ? String(schema.default)
            : example(schema)
        }
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : e.target.value)
        }
      />
    </Field>
  );
}
