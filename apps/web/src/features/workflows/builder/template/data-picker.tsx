"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { upstream } from "../settings/data-references";
import { useBuilder } from "../store";
import { PickerBlock } from "./picker-block";

const LOOP_FIELDS = [
  { path: "loop.item", name: "Current item", type: "item" },
  { path: "loop.index", name: "Position (0, 1, 2…)", type: "number" },
  { path: "loop.count", name: "Number of items", type: "number" },
];

/** Every field the selected block can use (earlier blocks, the loop item), searchable; picking one calls `onPick`. */
export function DataPicker({ onPick }: { onPick: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const { nodes, edges, selectedId } = useBuilder();
  const earlier = upstream(selectedId ?? "", edges)
    .map((id) => nodes.find((n) => n.id === id)?.data.block)
    .filter((b) => b !== undefined);
  const inLoop = earlier.some((b) => b.kind === "logic.loop");
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
        {inLoop && (
          <PickerBlock
            title="For each"
            fields={LOOP_FIELDS}
            query={q}
            onPick={onPick}
          />
        )}
        {earlier.map((b) => (
          <PickerBlock key={b.id} block={b} query={q} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
