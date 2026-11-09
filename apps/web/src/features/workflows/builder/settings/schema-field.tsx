"use client";

import { SchemaFieldArray } from "./schema-field-array";
import { SchemaFieldBoolean } from "./schema-field-boolean";
import { SchemaFieldEnum } from "./schema-field-enum";
import { SchemaFieldFile } from "./schema-field-file";
import { SchemaFieldJson } from "./schema-field-json";
import { SchemaFieldText } from "./schema-field-text";
import { typeWords } from "./schema-fields-list";
import type { JsonSchema } from "./tools-api";

const typeOf = (s: JsonSchema) =>
  (Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type) ??
  (s.anyOf ? "object" : "string");

/** "number · default 10 · e.g. 25": the type, the default and an example, when the app gives them. */
function metaLine(schema: JsonSchema): string {
  const parts = [typeWords(schema)];
  const plain = (v: unknown) =>
    typeof v === "object" ? JSON.stringify(v) : String(v);
  if (
    schema.default !== undefined &&
    schema.default !== "" &&
    !(Array.isArray(schema.default) && schema.default.length === 0)
  ) {
    parts.push(`default ${plain(schema.default)}`);
  }
  const example = schema.examples?.find((e) => e !== "" && e !== null);
  if (example !== undefined) parts.push(`e.g. ${plain(example).slice(0, 60)}`);
  return parts.join(" · ");
}

/** One input of an action, drawn by its type: a list, yes/no, a choice, JSON, or text. */
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
  const type = typeOf(schema);
  const common = {
    id: `arg-${name}`,
    label: schema.title ?? name,
    required,
    hint: schema.description,
    meta: metaLine(schema),
    value,
    onChange,
  };

  if (schema.file_uploadable || schema.items?.file_uploadable)
    return <SchemaFieldFile {...common} multiple={!schema.file_uploadable} />;
  if (schema.enum?.length)
    return <SchemaFieldEnum {...common} schema={schema} />;
  if (type === "boolean")
    return <SchemaFieldBoolean {...common} schema={schema} />;
  if (type === "array" && typeOf(schema.items ?? {}) !== "object")
    return <SchemaFieldArray {...common} />;
  if (type === "object" || type === "array")
    return <SchemaFieldJson {...common} />;
  return <SchemaFieldText {...common} name={name} schema={schema} />;
}
