"use client";

import { Trash2Icon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blockKindLabel, blockTitle } from "../block-label";
import type { Block, BlockBody } from "../blocks";
import { useBuilder } from "../store";
import { BlockSettings } from "./block-settings";
import { DataReferences } from "./data-references";
import { SettingsSection } from "./field";

/** The floating settings window on the right, for the selected block. */
export function SettingsPanel() {
  const { nodes, selectedId, select, updateBlock, removeBlock } = useBuilder();
  const issue = useBuilder(
    (s) => s.workflow?.issues.find((i) => i.nodeId === selectedId)?.message,
  );
  const node = nodes.find((n) => n.id === selectedId);
  if (!node) return null;
  const b = node.data.block;
  const update = (next: BlockBody) => updateBlock(b.id, () => next);

  return (
    <aside
      className="absolute top-3 right-3 bottom-3 z-10 flex w-[22rem] flex-col overflow-hidden rounded-xl border bg-card/95 shadow-lg backdrop-blur"
      aria-label="Block settings"
    >
      <div className="flex items-start gap-2 border-b p-3">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">{blockKindLabel(b)}</p>
          <Input
            aria-label="Block name"
            className="mt-1 h-8 font-medium"
            value={b.label ?? ""}
            placeholder={blockTitle({ ...b, label: undefined })}
            maxLength={80}
            onChange={(e) =>
              update({ ...b, label: e.target.value || undefined })
            }
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => select(null)}
          aria-label="Close settings"
        >
          <XIcon />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {issue && (
          <output className="mx-4 mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-300">
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
            {issue}
          </output>
        )}
        <BlockSettings block={b} update={update} />
        {!b.kind.startsWith("trigger.") && (
          <SettingsSection title="Data from earlier steps">
            <DataReferences id={b.id} />
          </SettingsSection>
        )}
      </div>
      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => removeBlock(b.id)}
        >
          <Trash2Icon />
          Delete block
        </Button>
      </div>
    </aside>
  );
}
