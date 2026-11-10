"use client";

import { Loader2Icon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { runWorkflow, type WorkflowApiError } from "../../api";
import { isActive, useRunView } from "../../live/run-view-store";
import { refreshRuns } from "../../live/use-live-runs";
import { useBuilder } from "../store";
import type { SaveState } from "../use-autosave";
import { RunFormDialog } from "./run-form-dialog";
import { SampleDialog } from "./sample-dialog";

const MAX_SAMPLE = 256 * 1024;

/** Runs the DRAFT now (a test run, on any workflow). A webhook workflow first asks for a sample body to send itself. */
export function RunButton({ save }: { save: { state: SaveState } }) {
  const w = useBuilder((s) => s.workflow);
  const select = useBuilder((s) => s.select);
  const going = useRunView((s) =>
    isActive(s.detail?.status ?? s.runs[0]?.status),
  );
  const [{ busy, sample, formOpen }, , store] = useLocalStore(() => ({
    busy: false,
    sample: null as string | null,
    formOpen: false,
  }));
  const setBusy = fieldSetter(store, "busy");
  const setSample = fieldSetter(store, "sample");
  const setFormOpen = fieldSetter(store, "formOpen");
  if (!w) return null;
  const webhook = w.graph.nodes.some((n) => n.kind === "trigger.webhook");
  // These test runs pretend to receive something: a webhook body, an app event's data.
  const sampleKind = webhook
    ? ("webhook" as const)
    : w.graph.nodes.some((n) => n.kind === "trigger.app")
      ? ("app" as const)
      : null;
  const appNode = w.graph.nodes.find((n) => n.kind === "trigger.app");
  const appTrigger =
    appNode?.kind === "trigger.app"
      ? appNode.config.trigger || undefined
      : undefined;
  const manual = w.graph.nodes.find((n) => n.kind === "trigger.manual");
  const fields = manual?.kind === "trigger.manual" ? manual.config.fields : [];

  async function start(input?: unknown) {
    setBusy(true);
    try {
      const { run } = await runWorkflow(w!.id, { mode: "test", input });
      useRunView.getState().view(run.id);
      void refreshRuns(w!.id);
      setSample(null);
      setFormOpen(false);
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
        onClick={() =>
          sampleKind
            ? setSample("{}")
            : fields.length > 0
              ? setFormOpen(true)
              : void start()
        }
      >
        {busy || going ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <PlayIcon />
        )}
        {sampleKind ? "Test run" : "Run"}
      </Button>
      <RunFormDialog
        fields={fields}
        open={formOpen}
        busy={busy}
        onOpenChange={setFormOpen}
        onRun={(inputs) => void start(inputs)}
      />
      {sampleKind && (
        <SampleDialog
          kind={sampleKind}
          workflowId={w.id}
          triggerSlug={appTrigger}
          sample={sample}
          busy={busy}
          onChange={setSample}
          onRun={startWithSample}
        />
      )}
    </>
  );
}
