import type { JsonSchema } from "../settings/tools-api";

/**
 * Composio describes every action's output as `{ data, error, successful }`, but a run stores only `data`
 * (composio/execute.ts). The picker must offer what the run stores.
 */
export function unwrapComposio(schema: JsonSchema): JsonSchema {
  const p = schema.properties;
  if (p?.data && (p.successful || p.error)) return p.data;
  return schema;
}

/** The shape of a real value (a test run's output, a pinned sample): names and types, never the values. */
export function shapeOf(value: unknown, depth = 0): JsonSchema {
  if (Array.isArray(value)) {
    // ponytail: the first object item stands for all; merge several items if lists turn out mixed.
    const first = value.find((v) => v && typeof v === "object");
    return {
      type: "array",
      ...(first && depth < 6 ? { items: shapeOf(first, depth + 1) } : {}),
    };
  }
  if (value && typeof value === "object") {
    if (depth >= 6) return { type: "object" };
    const entries = Object.entries(value).slice(0, 200);
    return {
      type: "object",
      properties: Object.fromEntries(
        entries.map(([k, v]) => [k, shapeOf(v, depth + 1)]),
      ),
    };
  }
  if (typeof value === "number") return { type: "number" };
  if (typeof value === "boolean") return { type: "boolean" };
  return { type: "string" };
}

/** The schema with what a real output showed added: real fields fill in what the schema left vague. */
export function mergeShape(
  schema: JsonSchema,
  real: JsonSchema | null,
): JsonSchema {
  if (!real) return schema;
  const props = { ...real.properties };
  for (const [k, s] of Object.entries(schema.properties ?? {})) {
    props[k] = props[k] ? mergeShape(s, props[k]) : s;
  }
  const merged: JsonSchema = {
    ...real,
    ...schema,
    type: schema.type ?? real.type,
  };
  if (Object.keys(props).length) merged.properties = props;
  const items = schema.items ?? real.items;
  if (items)
    merged.items =
      schema.items && real.items ? mergeShape(schema.items, real.items) : items;
  return merged;
}

/** The schema at a dotted path ("messages" → the list's schema), or null. */
export function schemaAt(schema: JsonSchema, path: string): JsonSchema | null {
  let s: JsonSchema | undefined = schema;
  for (const key of path.split(".").filter(Boolean)) {
    s = /^\d+$/.test(key) ? s?.items : s?.properties?.[key];
    if (!s) return null;
  }
  return s ?? null;
}
