"use client";

import { Loader2Icon, PlayIcon } from "lucide-react";
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
import { runWorkflow, type WorkflowApiError } from "../../api";
import { isActive, useRunView } from "../../live/run-view-store";
import { refreshRuns } from "../../live/use-live-runs";
import { useBuilder } from "../store";
import type { SaveState } from "../use-autosave";

const MAX_SAMPLE = 256 * 1024;

/** Runs the DRAFT now (a test run, on any workflow). A webhook workflow first asks for a sample body to send itself. */
export function RunButton({ save }: { save: { state: SaveState } }) {
  const w = useBuilder((s) => s.workflow);
  const select = useBuilder((s) => s.select);
  const going = useRunView((s) =>
    isActive(s.detail?.status ?? s.runs[0]?.status),
  );
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<string | null>(null);
  if (!w) return null;
  const webhook = w.graph.nodes.some((n) => n.kind === "trigger.webhook");

  async function start(input?: unknown) {
    setBusy(true);
    try {
      const { run } = await runWorkflow(w!.id, { mode: "test", input });
      useRunView.getState().view(run.id);
      void refreshRuns(w!.id);
      setSample(null);
    } catch (e) {
      const err = e as WorkflowApiError;
      const first = err.issues?.[0]?.nodeId;
      if (first) select(first);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startWithSample() {
    if (sample === null) return;
    if (new Blob([sample]).size > MAX_SAMPLE)
      return void toast.error("The sample is too large (256 KB at most).");
    try {
      void start(sample.trim() ? JSON.parse(sample) : {});
    } catch {
      toast.error("The sample is not valid JSON.");
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || going || save.state !== "saved"}
        onClick={() => (webhook ? setSample("{}") : void start())}
      >
        {busy || going ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <PlayIcon />
        )}
        {webhook ? "Test run" : "Run"}
      </Button>
      <Dialog
        open={sample !== null}
        onOpenChange={(open) => !open && setSample(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test run</DialogTitle>
            <DialogDescription>
              The JSON body to pretend the webhook received. It runs your draft
              for real, so apps are really called.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-32 font-mono text-xs"
            value={sample ?? ""}
            onChange={(e) => setSample(e.target.value)}
            aria-label="Sample JSON body"
          />
          <DialogFooter>
            <Button disabled={busy} onClick={startWithSample}>
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
