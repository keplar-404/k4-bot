"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelRun, type RunDetail } from "../api";
import { useBuilder } from "../builder/store";
import { ApprovalAnswer, waitingApproval } from "./approval-answer";
import { isActive, useRunView } from "./run-view-store";

const FINISHED_STEP = ["succeeded", "failed", "skipped"];

function bannerText(run: RunDetail, totalBlocks: number) {
  if (waitingApproval(run)) return "Waiting for your OK";
  if (isActive(run.status)) {
    const done = run.steps.filter((s) => FINISHED_STEP.includes(s.status));
    return `Running · ${done.length} of ${totalBlocks} blocks`;
  }
  if (run.status === "cancelled") return "Cancelled";
  if (run.status === "succeeded")
    return "Succeeded · select a block to see its output";
  const failedAt = run.steps.find((s) => s.nodeId === run.failedNodeId);
  // "action.http" → "http": the kind is enough to find the block on the canvas.
  const where = failedAt ? ` at ${failedAt.nodeKind.replace(/^.*\./, "")}` : "";
  return `Failed${where}: ${run.error ?? "see the run"}`;
}

/** A pill over the canvas: how the watched run is going, with Cancel while it runs and a way to close the run view. */
export function RunBanner() {
  const run = useRunView((s) => s.detail);
  const total = useBuilder((s) => s.nodes.length);
  const view = useRunView((s) => s.view);
  if (!run) return null;
  const active = isActive(run.status);
  const text = bannerText(run, total);
  const waiting = waitingApproval(run);
  return (
    <div className="absolute top-3 left-1/2 z-10 flex max-w-[min(32rem,90%)] -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 py-1 pr-1 pl-3 text-xs shadow">
      {active && (
        <Loader2Icon
          className="size-3.5 shrink-0 animate-spin text-sky-500"
          aria-hidden
        />
      )}
      <output
        className={`truncate ${run.status === "failed" ? "text-destructive" : ""}`}
      >
        {text}
      </output>
      {waiting && <ApprovalAnswer runId={run.id} step={waiting} compact />}
      {active && (
        <Button
          size="xs"
          variant="outline"
          onClick={() =>
            cancelRun(run.id).catch((e: Error) => toast.error(e.message))
          }
        >
          Cancel
        </Button>
      )}
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Close run view"
        onClick={() => view(null)}
      >
        <XIcon />
      </Button>
    </div>
  );
}
