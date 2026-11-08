"use client";

import { Field } from "./field";
import { SchemaFieldArray } from "./schema-field-array";
import { SchemaFieldBoolean } from "./schema-field-boolean";
import { SchemaFieldEnum } from "./schema-field-enum";
import { SchemaFieldJson } from "./schema-field-json";
import { SchemaFieldText } from "./schema-field-text";
import type { JsonSchema } from "./tools-api";

const typeOf = (s: JsonSchema) =>
  (Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type) ??
  (s.anyOf ? "object" : "string");

export function SchemaField({
  name,
  schema,
  required,
  value,
  onChange,
}: {
  name: string;
  schema: JsonSchema;
  required: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `arg-${name}`;
  const label = schema.title ?? name;
  const type = typeOf(schema);
  const hint = schema.description?.slice(0, 220);

  if (schema.enum?.length) {
    return (
      <SchemaFieldEnum
        id={id}
        label={label}
        required={required}
        hint={hint}
        schema={schema}
        value={value}
        onChange={onChange}
      />
    );
  }
  if (type === "boolean") {
    return (
      <SchemaFieldBoolean
        id={id}
        label={label}
        required={required}
        hint={hint}
        schema={schema}
        value={value}
        onChange={onChange}
      />
    );
  }
  if (type === "array" && typeOf(schema.items ?? {}) !== "object") {
    return (
      <SchemaFieldArray
        id={id}
        label={label}
        required={required}
        hint={hint}
        value={value}
        onChange={onChange}
      />
    );
  }
  if (type === "object" || type === "array") {
    return (
      <SchemaFieldJson
        id={id}
        label={label}
        required={required}
        hint={hint}
        value={value}
        onChange={onChange}
      />
    );
  }
  return (
    <SchemaFieldText
      id={id}
      name={name}
      label={label}
      required={required}
      hint={hint}
      schema={schema}
      value={value}
      onChange={onChange}
    />
  );
}
