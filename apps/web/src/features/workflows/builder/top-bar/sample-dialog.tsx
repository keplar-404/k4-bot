"use client";

import { HistoryIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getRun, listRuns } from "../../api";

const COPY = {
  webhook: {
    what: "The JSON body to pretend the webhook received.",
    last: "Use the last real request",
    trigger: "webhook",
    field: "body",
  },
  app: {
    what: "The event data to pretend the app sent.",
    last: "Use the last real event",
    trigger: "app",
    field: "data",
  },
} as const;

/**
 * A test run of a webhook or app-event workflow: the sample it pretends to receive. "Use the last real…" fills in
 * what the latest real call brought (read from that run, so nothing extra is stored).
 */
export function SampleDialog({
  kind,
  workflowId,
  sample,
  busy,
  onChange,
  onRun,
}: {
  kind: keyof typeof COPY;
  workflowId: string;
  sample: string | null;
  busy: boolean;
  onChange: (sample: string | null) => void;
  onRun: () => void;
}) {
  const copy = COPY[kind];
  const [loading, setLoading] = useState(false);
  async function fillFromLast() {
    setLoading(true);
    try {
      const real = (await listRuns(workflowId)).items.find(
        (r) => r.trigger === copy.trigger,
      );
      if (!real)
        return void toast.info(
          `No real ${kind === "app" ? "event" : "request"} has arrived yet. Turn the workflow on and send one.`,
        );
      const input = (await getRun(real.id)).input as
        | Record<string, unknown>
        | undefined;
      onChange(JSON.stringify(input?.[copy.field] ?? {}, null, 2));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load it.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog
      open={sample !== null}
      onOpenChange={(open) => !open && onChange(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test run</DialogTitle>
          <DialogDescription>
            {copy.what} It runs your draft for real, so apps are really called.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          className="min-h-32 font-mono text-xs"
          value={sample ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Sample JSON"
        />
        <DialogFooter>
          <Button
            variant="outline"
            className="mr-auto"
            disabled={loading}
            onClick={() => void fillFromLast()}
          >
            <HistoryIcon />
            {copy.last}
          </Button>
          <Button disabled={busy} onClick={onRun}>
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
