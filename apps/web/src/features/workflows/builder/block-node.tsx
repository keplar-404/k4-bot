"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { cn } from "cn";
import { RepeatIcon, TriangleAlertIcon } from "lucide-react";
import { memo } from "react";
import { AppLogo } from "@/features/connect/components/app-logo";
import { logoOf } from "../describe";
import { infoOf } from "./block-catalog";
import { BlockHandles, handle } from "./block-handles";
import { blockKindLabel, blockTitle } from "./block-label";
import type { FlowNode } from "./flow";
import { useNodeOverlay } from "./node-overlay";

/**
 * One block on the canvas: icon (or the app's logo), kind, title. A trigger has no input; an If block has two
 * outputs (true / false). The ring shows selection, an unfinished setup, or a live run's state.
 */
function BlockNodeView({ data, selected }: NodeProps<FlowNode>) {
  const b = data.block;
  const overlay = useNodeOverlay(b.id);
  const Icon = infoOf(b.kind)?.icon;
  const isTrigger = b.kind.startsWith("trigger.");
  const retries =
    b.kind === "action.app" && (b.retry?.maxAttempts ?? 1) > 1
      ? b.retry!.maxAttempts
      : 0;
  return (
    <div
      className={cn(
        "relative flex w-60 items-center gap-3 rounded-xl border bg-card p-2.5 pr-3 text-card-foreground shadow-xs transition-shadow",
        selected && "ring-2 ring-ring",
        overlay.ring,
      )}
    >
      {!isTrigger && (
        <Handle type="target" position={Position.Top} className={handle} />
      )}
      {(b.kind === "action.app" || b.kind === "trigger.app") &&
      b.config.toolkit ? (
        <AppLogo src={logoOf(b.config.toolkit)} name={b.config.toolkit} />
      ) : (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            isTrigger ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          {Icon && <Icon className="size-5" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-muted-foreground text-xs">
          {isTrigger ? `Trigger · ${blockKindLabel(b)}` : blockKindLabel(b)}
        </p>
        <p className="truncate font-medium text-sm">{blockTitle(b)}</p>
      </div>
      {overlay.icon}
      {!overlay.icon && overlay.issue && (
        <TriangleAlertIcon
          className="size-4 shrink-0 text-amber-500"
          aria-label={overlay.issue}
        />
      )}
      {retries > 0 && (
        <span
          className="absolute -top-2 right-3 flex items-center gap-0.5 rounded-full border bg-background px-1.5 text-[10px] text-muted-foreground"
          title={`Retries up to ${retries} times`}
        >
          <RepeatIcon className="size-2.5" />
          {retries}×
        </span>
      )}
      <BlockHandles block={b} />
    </div>
  );
}

export const BlockNode = memo(BlockNodeView);

/** Defined once, outside any component: React Flow re-mounts every node if this object changes. */
export const nodeTypes = { block: BlockNode };
