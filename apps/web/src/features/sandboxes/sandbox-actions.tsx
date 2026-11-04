"use client";

import { Loader2Icon, PauseIcon, PlayIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SandboxRow } from "./api";
import type { SandboxAction } from "./use-sandboxes";

/** Start or Pause (whichever applies) and Delete for one sandbox; a spinner while its action runs. */
export function SandboxActions({ row, busy, onAction, onDelete }: { row: SandboxRow; busy: boolean; onAction: (a: SandboxAction, botId: string) => void; onDelete: (row: SandboxRow) => void }) {
  if (busy) return <Loader2Icon className="ml-auto size-4 animate-spin" aria-label="Working" />;
  const running = row.status === "running";
  return (
    <span className="inline-flex gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`${running ? "Pause" : "Start"} ${row.botName}'s sandbox`}
        onClick={() => onAction(running ? "pause" : "start", row.botId)}
      >
        {running ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${row.botName}'s sandbox`} onClick={() => onDelete(row)}>
        <Trash2Icon />
      </Button>
    </span>
  );
}
