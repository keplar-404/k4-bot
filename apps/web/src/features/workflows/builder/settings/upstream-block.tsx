"use client";

import { ChevronRightIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { blockTitle } from "../block-label";
import type { BlockBody } from "../blocks";
import { useBlockSchema } from "../template/block-fields";
import { SchemaFieldsList } from "./schema-fields-list";

/** One earlier block, folded: open it to see each field it gives, with its type and meaning. */
export function UpstreamBlock({ block }: { block: BlockBody }) {
  const { prefix, schema, loading } = useBlockSchema(block);

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
        {loading ? (
          <p className="text-muted-foreground text-xs">Loading its fields…</p>
        ) : (
          <SchemaFieldsList schema={schema ?? {}} prefix={prefix} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
