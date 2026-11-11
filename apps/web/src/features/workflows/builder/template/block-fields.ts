"use client";

import { useEffect, useMemo } from "react";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { useRunView } from "../../live/run-view-store";
import type { BlockBody } from "../blocks";
import {
  fetchTool,
  fetchTrigger,
  type JsonSchema,
} from "../settings/tools-api";
import { useBuilder } from "../store";
import { builtinSchema } from "./builtin-schemas";
import { mergeShape, shapeOf, unwrapComposio } from "./shape";

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
  if (type === "array" || (!type && schema.items)) return "list";
  if (type === "object" || (!type && schema.properties)) return "object";
  return "text";
}

/** Every field of a schema as a reference, into nested objects ("preview.body"), at most 4 levels deep. */
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
      depth < 3 && field.properties ? fieldsOf(field, path, depth + 1) : [];
    return [own, ...nested.map((f) => ({ ...f, name: `${key}.${f.name}` }))];
  });
}

/** A block's described fields (loaded from Composio for app blocks), or null while loading. */
export function useBlockSchema(block: BlockBody): {
  prefix: string;
  schema: JsonSchema | null;
  loading: boolean;
} {
  const { prefix, schema: source } = sourceOf(block);
  const [{ schema }, , store] = useLocalStore(() => ({
    schema: null as JsonSchema | null,
  }));
  const setSchema = fieldSetter(store, "schema");
  const from = source?.from;
  const slug = source?.slug;
  useEffect(() => {
    setSchema(null);
    if (!from || !slug) return;
    const load =
      from === "event"
        ? fetchTrigger(slug).then((t) => t.payload)
        : fetchTool(slug).then((t) => unwrapComposio(t.output));
    load.then(setSchema, () => setSchema({}));
  }, [from, slug, setSchema]);
  // What the block really gave (its pinned sample, or the shown run's output) fills in what the schema left vague.
  const real = useRealShape(block.id);
  // Built-in blocks describe their output from their own settings (Set fields, form questions…), live as they change.
  const described = slug ? schema : (builtinSchema(block) ?? {});
  return {
    prefix,
    schema: described ? mergeShape(described, real) : real,
    loading: Boolean(slug) && !schema && !real,
  };
}

/** The shape of the block's pinned sample, or of its output in the run on screen; null when there is neither. */
function useRealShape(id: string): JsonSchema | null {
  const pin = useBuilder((s) => s.pins[id]);
  const ran = useRunView(
    (s) => s.detail?.steps.find((x) => x.nodeId === id)?.output,
  );
  const value = pin ?? ran;
  return useMemo(() => (value == null ? null : shapeOf(value)), [value]);
}
