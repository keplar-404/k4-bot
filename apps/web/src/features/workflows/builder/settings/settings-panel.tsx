"use client";

import {
  MousePointerClickIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlockBody } from "../blocks";
import { usePanels } from "../panels-store";
import { useBuilder } from "../store";
import { SettingsHeader } from "./settings-header";
import { SettingsTabs } from "./settings-tabs";

const PANEL =
  "absolute top-3 right-3 bottom-3 z-10 flex w-[22rem] flex-col overflow-hidden rounded-xl border bg-card/95 shadow-lg backdrop-blur";

/**
 * The settings window on the right. It opens and closes with its own button (like the block library), never by
 * selecting a block: while it is open it shows whichever block is selected.
 */
export function SettingsPanel() {
  const open = usePanels((s) => s.settings);
  const setOpen = (v: boolean) => usePanels.getState().toggle("settings", v);
  const { nodes, selectedId, updateBlock, removeBlock } = useBuilder();
  const issue = useBuilder(
    (s) => s.workflow?.issues.find((i) => i.nodeId === selectedId)?.message,
  );
  const node = nodes.find((n) => n.id === selectedId);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="absolute top-3 right-3 z-10 shadow-sm"
        onClick={() => setOpen(true)}
        aria-label="Show settings"
        title="Show settings ( ] )"
      >
        <PanelRightOpenIcon />
      </Button>
    );
  }
  if (!node) {
    return (
      <aside className={PANEL} aria-label="Block settings">
        <div className="flex justify-end p-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="Hide settings"
          >
            <PanelRightCloseIcon />
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground text-sm">
          <MousePointerClickIcon className="size-5" />
          Select a block to see its settings.
        </div>
      </aside>
    );
  }

  const b = node.data.block;
  const update = (next: BlockBody) => updateBlock(b.id, () => next);
  return (
    <aside className={PANEL} aria-label="Block settings">
      <SettingsHeader
        block={b}
        update={update}
        onClose={() => setOpen(false)}
      />
      <SettingsTabs block={b} update={update} issue={issue} />
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
