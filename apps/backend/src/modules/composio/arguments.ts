type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  anyOf?: Schema[];
  title?: string;
};

/** The schema's main type, ignoring "null" ("integer | null" is an integer). */
function typeOf(schema: Schema): string | undefined {
  if (Array.isArray(schema.type)) return schema.type.find((t) => t !== "null");
  if (schema.type) return schema.type;
  return schema.anyOf?.map(typeOf).find((t) => t !== undefined && t !== "null");
}

const isBlank = (value: unknown) => value === undefined || value === null || value === "";

/**
 * Turns one filled-in value into the type the action expects. Workflow templates always produce text ("5", "true",
 * '["a"]'), while Composio validates types strictly and refuses "5" for an integer. A value that cannot be read as the
 * expected type is passed through unchanged, so Composio's own error names the field.
 */
function toSchemaType(value: unknown, schema: Schema): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  switch (typeOf(schema)) {
    case "integer":
    case "number": {
      const n = Number(text);
      return text !== "" && Number.isFinite(n) ? n : value;
    }
    case "boolean":
      if (/^(true|yes|1)$/i.test(text)) return true;
      if (/^(false|no|0)$/i.test(text)) return false;
      return value;
    case "array":
      if (text.startsWith("[")) return parseJson(text) ?? value;
      // One plain value where a list is expected: a list of one (e.g. a single recipient).
      return [toSchemaType(text, schema.items ?? {})];
    case "object":
      return text.startsWith("{") ? (parseJson(text) ?? value) : value;
    default:
      return value;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Fits arguments to an action's input schema before it runs: values become the declared types, optional fields left
 * empty (a template whose data was missing) are dropped, and required fields that are still empty are reported by name.
 */
export function fitArguments(
  input: Schema,
  args: Record<string, unknown>,
): { args: Record<string, unknown> } | { missing: string[] } {
  const properties = input.properties ?? {};
  const required = new Set(input.required ?? []);
  const fitted: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(args)) {
    if (isBlank(value) && !required.has(name)) continue;
    const schema = properties[name];
    fitted[name] = schema ? toSchemaType(value, schema) : value;
  }

  const missing = [...required].filter((name) => isBlank(fitted[name]));
  if (missing.length > 0) return { missing: missing.map((name) => properties[name]?.title ?? name) };
  return { args: fitted };
}
