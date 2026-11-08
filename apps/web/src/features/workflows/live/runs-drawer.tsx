"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RunStatusBadge } from "../components/status-badges";
import { RunSteps } from "./run-steps";
import { useRunView } from "./run-view-store";
import { StepIo } from "./step-io";

const when = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const seconds = (a: string | null, b: string | null) =>
  a && b
    ? `${Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 100) / 10)} s`
    : "";

/** The workflow's run history. Pick a run to see it on the canvas and each block's input, output and error. */
export function RunsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const runs = useRunView((s) => s.runs);
  const viewedId = useRunView((s) => s.viewedId);
  const view = useRunView((s) => s.view);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Runs</SheetTitle>
          <SheetDescription>
            The latest runs of this workflow. Input and output of a block are
            kept for the run viewer only.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 p-4 pt-0">
          {runs.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No runs yet. Press Run.
            </p>
          )}
          {runs.map((r) => (
            <div key={r.id} className="rounded-md border">
              <button
                type="button"
                aria-pressed={viewedId === r.id}
                className={`flex w-full items-center justify-between gap-2 rounded-md p-2 text-left text-sm hover:bg-muted ${viewedId === r.id ? "bg-muted" : ""}`}
                onClick={() => view(viewedId === r.id ? null : r.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate">
                    {when(r.createdAt)} · {r.trigger}
                  </span>
                  {r.error && (
                    <span className="block truncate text-destructive text-xs">
                      {r.error}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs">
                  {seconds(r.startedAt, r.finishedAt)}
                  <RunStatusBadge status={r.status} compact />
                </span>
              </button>
              {viewedId === r.id && (
                <div className="border-t">
                  <RunSteps />
                  <StepIo />
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
