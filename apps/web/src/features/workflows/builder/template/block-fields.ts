"use client";

import { useEffect, useState } from "react";
import type { BlockBody } from "../blocks";
import {
  fetchTool,
  fetchTrigger,
  type JsonSchema,
} from "../settings/tools-api";

/** The MIME type a dragged field carries: its reference path (dropped into a template field). */
export const REF_DRAG_TYPE = "application/x-k4-ref";

export type DataField = {
  path: string;
  name: string;
  type: string;
  description?: string;
};
type Source = {
  prefix: string;
  schema?: { from: "event" | "action"; slug: string };
};

/** Where a block's data is read from, and which Composio schema describes it (when there is one). */
export function sourceOf(b: BlockBody): Source {
  switch (b.kind) {
    case "trigger.app":
      return {
        prefix: "trigger.data",
        schema: b.config.trigger
          ? { from: "event", slug: b.config.trigger }
          : undefined,
      };
    case "trigger.webhook":
      return { prefix: "trigger.body" };
    case "trigger.manual":
      return { prefix: "trigger.inputs" };
    case "trigger.schedule":
      return { prefix: "trigger" };
    case "action.app":
      return {
        prefix: `steps.${b.id}.output`,
        schema: b.config.tool
          ? { from: "action", slug: b.config.tool }
          : undefined,
      };
    default:
      return { prefix: `steps.${b.id}.output` };
  }
}

/** A JSON Schema type in plain words. */
export function typeWords(schema: JsonSchema): string {
  const type = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null")
    : schema.type;
  if (type === "integer" || type === "number") return "number";
  if (type === "boolean") return "yes / no";
  if (type === "array") return "list";
  if (type === "object") return "object";
  return "text";
}

/** Every field of a schema as a reference, one level into nested objects ("data.subject"). */
export function fieldsOf(
  schema: JsonSchema,
  prefix: string,
  depth = 0,
): DataField[] {
  return Object.entries(schema.properties ?? {}).flatMap(([key, field]) => {
    const path = `${prefix}.${key}`;
    const own: DataField = {
      path,
      name: key,
      type: typeWords(field),
      description: field.description,
    };
    const nested =
      depth < 1 && field.properties ? fieldsOf(field, path, depth + 1) : [];
    return [own, ...nested.map((f) => ({ ...f, name: `${key}.${f.name}` }))];
  });
}

/** A Decide block's outputs, from its own questions: one field per answer (and its confidence). */
function decideSchema(block: BlockBody): JsonSchema {
  if (block.kind !== "ai.decide") return {};
  const properties: Record<string, JsonSchema> = {};
  for (const q of block.config.questions) {
    const field =
      q.type === "noul" ? "noul" : q.type === "choice" ? "choice" : "score";
    properties[`answers.${q.id}.${field}`] = {
      type: q.type === "choice" ? "string" : "number",
      description:
        q.type === "noul"
          ? `Probability of yes (0–1): ${q.instructions}`
          : q.type === "choice"
            ? `The chosen label: ${q.instructions}`
            : `Expected value 0–1 (not a level): ${q.instructions}`,
    };
    if (q.type !== "noul")
      properties[`answers.${q.id}.confidence`] = {
        type: "number",
        description: "How sure (0–1)",
      };
  }
  return { type: "object", properties };
}

/** A block's described fields (loaded from Composio for app blocks), or null while loading. */
export function useBlockSchema(block: BlockBody): {
  prefix: string;
  schema: JsonSchema | null;
  loading: boolean;
} {
  const { prefix, schema: source } = sourceOf(block);
  const [schema, setSchema] = useState<JsonSchema | null>(null);
  const from = source?.from;
  const slug = source?.slug;
  useEffect(() => {
    setSchema(null);
    if (!from || !slug) return;
    const load =
      from === "event"
        ? fetchTrigger(slug).then((t) => t.payload)
        : fetchTool(slug).then((t) => t.output);
    load.then(setSchema, () => setSchema({}));
  }, [from, slug]);
  return {
    prefix,
    schema: slug ? schema : {},
    loading: Boolean(slug) && !schema,
  };
}
