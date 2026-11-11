"use client";

import { getRun, getWorkflow, type LiveEvent, listRuns } from "../api";
import { useAssistant } from "../assistant/store";
import { useBuilder } from "../builder/store";
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

let reloadTimer: ReturnType<typeof setTimeout> | undefined;

/** The assistant changed the draft: load it (several quick edits become one fetch). */
function reloadDraft(workflowId: string) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    try {
      const w = await getWorkflow(workflowId);
      if (useBuilder.getState().workflow?.id === workflowId)
        useBuilder.getState().reload(w);
    } catch {
      // The next change or the lock's end reloads again.
    }
  }, 150);
}

export function applyLiveEvent(workflowId: string, event: LiveEvent) {
  if (event.type === "draft.updated") return reloadDraft(workflowId);
  if (event.type === "assistant.lock") {
    useBuilder.setState({ lockedBy: event.locked ? event.runId : null });
    if (!event.locked) reloadDraft(workflowId);
    return;
  }
  if (event.type === "assistant.parts")
    return useAssistant.getState().applyParts(event as never);
  if (event.type === "assistant.progress")
    return useAssistant.getState().applyProgress(event);
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
