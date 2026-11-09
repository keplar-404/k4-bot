"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApprovalAnswer } from "./approval-answer";
import { useRunView } from "./run-view-store";
import { ToolsUsed } from "./tools-used";

const STATUS_WORDS: Record<string, string> = {
  running: "Running now",
  retrying: "Retrying",
  waiting: "Waiting",
  succeeded: "Succeeded",
  failed: "Failed",
  skipped: "Skipped: its path was not taken",
};

function JsonBox({ label, value }: { label: string; value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-medium text-muted-foreground text-xs">
          {label}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => {
            void navigator.clipboard.writeText(text);
            toast.success(`${label} copied`);
          }}
        >
          <CopyIcon />
        </Button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-[11px]">
        {text}
      </pre>
    </div>
  );
}

/**
 * What this block did in the run shown on the canvas: its status, the input it was given and what it returned (secrets
 * already replaced by [secret:NAME] on the server). Nothing while no run is shown.
 */
export function BlockLastRun({ blockId }: { blockId: string }) {
  const step = useRunView((s) =>
    s.detail?.steps.find((x) => x.nodeId === blockId),
  );
  const runId = useRunView((s) => s.detail?.id);
  if (!runId) return null;
  if (!step)
    return (
      <p className="text-muted-foreground text-xs">
        This block has not run in the run shown.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <p
        className={`text-sm ${step.status === "failed" ? "text-destructive" : ""}`}
      >
        {STATUS_WORDS[step.status] ?? step.status}
        {step.attempt > 1 ? ` · try ${step.attempt}` : ""}
      </p>
      {step.error && <p className="text-destructive text-xs">{step.error}</p>}
      {step.status === "waiting" && step.nodeKind === "logic.approval" && (
        <ApprovalAnswer runId={runId} step={step} />
      )}
      <ToolsUsed output={step.output} />
      {step.output !== undefined && step.output !== null && (
        <JsonBox label="Output" value={step.output} />
      )}
      {step.input !== undefined && step.input !== null && (
        <JsonBox label="Input" value={step.input} />
      )}
    </div>
  );
}
