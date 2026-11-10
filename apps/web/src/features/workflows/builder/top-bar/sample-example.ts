import { fits } from "../settings/placeholder";
import type { JsonSchema } from "../settings/tools-api";

const typeOf = (s: JsonSchema) =>
  Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type;

const FORMAT_EXAMPLES: Record<string, string> = {
  email: "name@example.com",
  uri: "https://example.com",
  url: "https://example.com",
  "date-time": "2026-01-31T09:00:00Z",
  date: "2026-01-31",
  time: "09:00:00",
};

/**
 * A realistic value for one field of an event: the app's own example when it gives one (Composio's schema), else its
 * default, first allowed value or format, else a plain value of the right type. Nested objects are filled in too.
 */
export function exampleOf(schema: JsonSchema, name = "", depth = 0): unknown {
  const example = schema.examples?.find((e) => fits(schema, e));
  if (example !== undefined) return example;
  if (fits(schema, schema.default)) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  const format = (schema as { format?: string }).format;
  if (format && FORMAT_EXAMPLES[format]) return FORMAT_EXAMPLES[format];
  switch (typeOf(schema)) {
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    case "array":
      return schema.items && depth < 2
        ? [exampleOf(schema.items, name, depth + 1)]
        : [];
    case "object":
      return depth < 2 ? exampleObject(schema, depth + 1) : {};
    default:
      return name ? `example ${name.replace(/_/g, " ")}` : "example";
  }
}

/** An example object for an event's payload: one entry per field it describes. */
export function exampleObject(
  schema: JsonSchema,
  depth = 0,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, field]) => [
      key,
      exampleOf(field, key, depth),
    ]),
  );
}

/** For a webhook (nothing describes what callers send): a small, obviously made-up JSON body. */
export const WEBHOOK_EXAMPLE = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  plan: "pro",
};
