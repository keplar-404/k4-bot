"use client";

import { toast } from "sonner";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { runWorkflow, type WorkflowApiError } from "../../api";
import { useRunView } from "../../live/run-view-store";
import { refreshRuns } from "../../live/use-live-runs";
import { useBuilder } from "../store";

/** The blocks a run passes through before `id`. */
function before(edges: Array<{ source: string; target: string }>, id: string) {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of edges)
      if (e.target === cur && !seen.has(e.source))
        stack.push(e.source), seen.add(e.source);
  }
  return seen;
}

/**
 * "Test this step": a test run that stops after this block. Blocks before it reuse what they returned in the run
 * shown (and pinned outputs win), so apps before it are not called again when that data exists.
 */
export function useTestStep(blockId: string) {
  const [{ busy }, , store] = useLocalStore(() => ({
    busy: false,
  }));
  const setBusy = fieldSetter(store, "busy");
  async function test() {
    const { workflow, edges, saved } = useBuilder.getState();
    if (!workflow) return;
    if (!saved)
      return void toast.info("Saving your changes… try again in a second.");
    const upstream = before(edges, blockId);
    const steps = useRunView.getState().detail?.steps ?? [];
    const pins = Object.fromEntries(
      steps
        .filter(
          (s) =>
            upstream.has(s.nodeId) &&
            s.status === "succeeded" &&
            s.output !== undefined,
        )
        .map((s) => [s.nodeId, s.output]),
    );
    setBusy(true);
    try {
      const { run } = await runWorkflow(workflow.id, {
        mode: "test",
        until: blockId,
        pins,
      });
      useRunView.getState().view(run.id);
      void refreshRuns(workflow.id);
    } catch (e) {
      toast.error((e as WorkflowApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return { test, busy };
}
