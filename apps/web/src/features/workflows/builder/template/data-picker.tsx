"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { BlockBody } from "../blocks";
import { upstream } from "../settings/data-references";
import { useBuilder } from "../store";
import { fieldsOf, useBlockSchema } from "./block-fields";
import { PickerBlock } from "./picker-block";
import { schemaAt } from "./shape";

const LOOP_FIELDS = [
  { path: "loop.item", name: "Current item", type: "item" },
  { path: "loop.index", name: "Position (0, 1, 2…)", type: "number" },
  { path: "loop.count", name: "Number of items", type: "number" },
];

/**
 * For each: the loop's own fields, then the fields of one item of the list it goes through ("loop.item.subject"),
 * read from the block that list comes from.
 */
function LoopFields({
  loop,
  earlier,
  query,
  onPick,
}: {
  loop: Extract<BlockBody, { kind: "logic.loop" }>;
  earlier: BlockBody[];
  query: string;
  onPick: (path: string) => void;
}) {
  const ref = /^\{\{\s*steps\.([A-Za-z0-9_-]+)\.output\.?([^}]*?)\s*\}\}$/.exec(
    loop.config.items.trim(),
  );
  const source = earlier.find((b) => b.id === ref?.[1]);
  // Hooks run every render: with no source block the loop's own (unused) schema is read.
  const { schema } = useBlockSchema(source ?? loop);
  const list = source && schema ? schemaAt(schema, ref?.[2] ?? "") : null;
  const itemFields = list?.items ? fieldsOf(list.items, "loop.item") : [];
  return (
    <PickerBlock
      title="For each"
      fields={[...LOOP_FIELDS, ...itemFields]}
      query={query}
      onPick={onPick}
    />
  );
}

/** Every field the selected block can use (earlier blocks, the loop item), searchable; picking one calls `onPick`. */
export function DataPicker({ onPick }: { onPick: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const { nodes, edges, selectedId } = useBuilder();
  const earlier = upstream(selectedId ?? "", edges)
    .map((id) => nodes.find((n) => n.id === id)?.data.block)
    .filter((b) => b !== undefined);
  const loop = earlier.find((b) => b.kind === "logic.loop");
  const q = query.trim().toLowerCase();

  return (
    <div className="flex max-h-96 w-80 flex-col gap-2">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search data from earlier steps"
          aria-label="Search data"
        />
      </InputGroup>
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {earlier.length === 0 && (
          <p className="p-2 text-muted-foreground text-xs">
            Connect this block after another one to use its data.
          </p>
        )}
        {loop?.kind === "logic.loop" && (
          <LoopFields loop={loop} earlier={earlier} query={q} onPick={onPick} />
        )}
        {earlier.map((b) => (
          <PickerBlock key={b.id} block={b} query={q} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
