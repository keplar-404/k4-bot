import type { JsonSchema } from "./tools-api";

const typeOf = (s: JsonSchema) =>
  Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type;

/** Whether a value fits the field: an example of the wrong type would promise input the action refuses. */
export function fits(schema: JsonSchema, value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (schema.enum?.length) return schema.enum.includes(value);
  switch (typeOf(schema)) {
    case "integer":
      return Number.isInteger(
        typeof value === "string" ? Number(value) : value,
      );
    case "number":
      return Number.isFinite(typeof value === "string" ? Number(value) : value);
    case "boolean":
      return (
        typeof value === "boolean" || value === "true" || value === "false"
      );
    case "array":
    case "object":
      return typeof value === "object";
    default:
      return typeof value === "string" || typeof value === "number";
  }
}

const FORMAT_HINTS: Record<string, string> = {
  email: "name@example.com",
  uri: "https://…",
  url: "https://…",
  "date-time": "2026-01-31T09:00:00Z",
  date: "2026-01-31",
  time: "09:00:00",
};

const show = (v: unknown) =>
  typeof v === "object" ? JSON.stringify(v) : String(v);

/**
 * The grey text of an empty field, in order: the default (that is what an empty field does), else the first example
 * that fits the field's type, else a hint from its format. Nothing rather than something misleading.
 */
export function placeholderFor(schema: JsonSchema): string | undefined {
  if (fits(schema, schema.default)) return show(schema.default);
  const example = schema.examples?.find((e) => fits(schema, e));
  if (example !== undefined) return show(example);
  const format = (schema as { format?: string }).format;
  return format ? FORMAT_HINTS[format] : undefined;
}
