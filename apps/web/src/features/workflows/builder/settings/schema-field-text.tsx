"use client";

import { TemplateInput } from "../template/template-input";
import { Field } from "./field";
import { placeholderFor } from "./placeholder";
import type { JsonSchema } from "./tools-api";

/** Inputs that usually hold longer text get several lines. */
const LONG =
  /body|content|message|text|description|html|markdown|query|prompt/i;

/**
 * A text (or number) input of an app action. It can mix typed text with data from earlier steps (pills); the grey
 * text is what an empty field does (its default), else a fitting example.
 */
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
  return (
    <Field id={id} label={label} required={required} meta={meta} hint={hint}>
      <TemplateInput
        id={id}
        aria-label={label}
        multiline={LONG.test(name)}
        value={value === undefined ? "" : String(value)}
        placeholder={placeholderFor(schema)}
        onChange={(v) => onChange(v === "" ? undefined : v)}
      />
    </Field>
  );
}
