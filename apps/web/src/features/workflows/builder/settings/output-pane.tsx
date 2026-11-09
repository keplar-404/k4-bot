"use client";

import { FlaskConicalIcon, PinIcon, PinOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlockLastRun } from "../../live/block-last-run";
import { useRunView } from "../../live/run-view-store";
import { useBuilder } from "../store";
import { useTestStep } from "./use-test-step";

/**
 * What the block returns: its pinned sample (test runs use it instead of running the block) or what it did in the
 * run shown, with Pin / Unpin and "Test this step".
 */
export function OutputPane({ blockId }: { blockId: string }) {
  const pinned = useBuilder((s) => s.pins[blockId]);
  const isPinned = useBuilder((s) => blockId in s.pins);
  const setPin = useBuilder((s) => s.setPin);
  const step = useRunView((s) =>
    s.detail?.steps.find((x) => x.nodeId === blockId),
  );
  const runShown = useRunView((s) => s.detail !== null);
  const { test, busy } = useTestStep(blockId);
  const canPin =
    !isPinned &&
    step?.status === "succeeded" &&
    step.output !== undefined &&
    step.output !== null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void test()}
        >
          <FlaskConicalIcon />
          Test this step
        </Button>
        {canPin && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPin(blockId, step.output)}
          >
            <PinIcon />
            Pin this output
          </Button>
        )}
        {isPinned && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPin(blockId, undefined)}
          >
            <PinOffIcon />
            Unpin
          </Button>
        )}
      </div>
      {isPinned && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Pinned: test runs use this instead of running the block. Live runs
            always run it.
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-[11px]">
            {JSON.stringify(pinned, null, 2)}
          </pre>
        </div>
      )}
      {runShown ? (
        <BlockLastRun blockId={blockId} />
      ) : (
        <p className="text-muted-foreground text-xs">
          Test this step (or run the workflow) to see what this block gets and
          returns.
        </p>
      )}
    </div>
  );
}
