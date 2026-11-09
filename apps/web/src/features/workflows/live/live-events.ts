"use client";

import { getRun, type LiveEvent, listRuns } from "../api";
import { isActive, useRunView } from "./run-view-store";

/** Reloads the run list (after starting a run, and when a run starts or ends). */
export async function refreshRuns(workflowId: string) {
  try {
    useRunView.getState().setRuns((await listRuns(workflowId)).items);
  } catch {
    // The list is a convenience: a failed reload keeps the old one.
  }
}

/** Reloads the watched run with every step's input and output, if it is still the one being watched. */
export async function refreshDetail(runId: string) {
  try {
    const run = await getRun(runId);
    if (useRunView.getState().viewedId === runId)
      useRunView.getState().setDetail(run);
  } catch {
    // A blip: the next event or poll tries again.
  }
}

export function applyLiveEvent(workflowId: string, event: LiveEvent) {
  const view = useRunView.getState();
  if (event.type === "run.started") {
    void refreshRuns(workflowId);
    // Follow a new run (from another tab, the schedule, a webhook or a bot) unless another one is being watched live.
    if (!isActive(view.detail?.status)) view.view(event.runId);
    return;
  }
  if (event.runId !== view.viewedId) return;
  if (event.type === "step") {
    view.applyStep(event);
    // A waiting or finished step has an output the event does not carry (an approval's question, a result).
    if (event.status !== "running" && event.status !== "retrying")
      void refreshDetail(event.runId);
    return;
  }
  void refreshDetail(event.runId);
  void refreshRuns(workflowId);
}
