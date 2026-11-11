"use client";

import { Loader2Icon, SparklesIcon, SquareIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBuilder } from "../builder/store";
import { stopRun } from "./api";

/** While the assistant edits this workflow: says so over the canvas, with Stop. */
export function LockBanner() {
  const runId = useBuilder((s) => s.lockedBy);
  if (!runId) return null;
  return (
    <output className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card/95 py-1 pr-1 pl-3 text-sm shadow-md backdrop-blur">
      <SparklesIcon className="size-4 text-primary" />
      <span>Assistant is building…</span>
      <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
      <Button
        size="xs"
        variant="ghost"
        onClick={() =>
          stopRun(runId).then(
            () => toast.info("Stopping… what it changed so far is kept."),
            (e: Error) => toast.error(e.message),
          )
        }
      >
        <SquareIcon />
        Stop
      </Button>
    </output>
  );
}
