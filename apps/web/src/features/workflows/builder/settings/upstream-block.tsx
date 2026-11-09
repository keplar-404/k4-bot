"use client";

import { ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { blockTitle } from "../block-label";
import type { BlockBody } from "../blocks";
import { SchemaFieldsList } from "./schema-fields-list";
import { fetchTool, fetchTrigger, type JsonSchema } from "./tools-api";

type Source = {
  prefix: string;
  schema?: { from: "event" | "action"; slug: string };
};

/** Where a block's data is read from, and which Composio schema describes it (when there is one). */
function sourceOf(b: BlockBody): Source {
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

/** One earlier block, folded: open it to see each field it gives, with its type and meaning. */
export function UpstreamBlock({ block }: { block: BlockBody }) {
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

  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted">
        <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-data-panel-open:rotate-90" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs">{blockTitle(block)}</span>
          <code className="block truncate text-[11px] text-muted-foreground">{`{{${prefix}}}`}</code>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t p-2">
        {slug && !schema ? (
          <p className="text-muted-foreground text-xs">Loading its fields…</p>
        ) : (
          <SchemaFieldsList schema={schema ?? {}} prefix={prefix} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
