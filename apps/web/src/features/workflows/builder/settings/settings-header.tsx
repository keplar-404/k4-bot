"use client";

import { PanelRightCloseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blockKindLabel, blockTitle } from "../block-label";
import type { BlockBody } from "../blocks";

/** The panel's top: the block's kind, its editable name, and the button that hides the panel. */
export function SettingsHeader({
  block,
  update,
  onClose,
}: {
  block: BlockBody;
  update: (b: BlockBody) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-2 border-b p-3">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{blockKindLabel(block)}</p>
        <Input
          aria-label="Block name"
          className="mt-1 h-8 font-medium"
          value={block.label ?? ""}
          placeholder={blockTitle({ ...block, label: undefined })}
          maxLength={80}
          onChange={(e) =>
            update({ ...block, label: e.target.value || undefined })
          }
        />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="Hide settings"
        title="Hide settings ( ] )"
      >
        <PanelRightCloseIcon />
      </Button>
    </div>
  );
}
