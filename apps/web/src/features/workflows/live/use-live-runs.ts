"use client";

import { useEffect, useRef, useState } from "react";
import { getRun, type LiveEvent, listRuns } from "../api";
import { type StepState, useRunOverlay } from "../builder/node-overlay";
import { useBuilder } from "../builder/store";
import { connectLive } from "./live-socket";
import { isActive, useRunView } from "./run-view-store";

const POLL_MS = 2000;

/** Reloads the run list (after starting a run, and when a run starts or ends). */
export async function refreshRuns(workflowId: string) {
  try {
    useRunView.getState().setRuns((await listRuns(workflowId)).items);
  } catch {
    // The list is a convenience: a failed reload keeps the old one.
  }
}

/** Reloads the watched run with every step's input and output, if it is still the one being watched. */
async function refreshDetail(runId: string) {
  try {
    const run = await getRun(runId);
    if (useRunView.getState().viewedId === runId)
      useRunView.getState().setDetail(run);
  } catch {
    // A blip: the next event or poll tries again.
  }
}

function applyLiveEvent(workflowId: string, event: LiveEvent) {
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
    return;
  }
  void refreshDetail(event.runId);
  void refreshRuns(workflowId);
}

/**
 * Shows runs on the canvas as they happen. The live socket pushes each step change; on every (re)connect the run
 * list and the watched run are reloaded, so missed events do not matter. If the socket keeps failing, the watched
 * run is polled every 2 s instead.
 */
export function useLiveRuns(workflowId: string) {
  const viewedId = useRunView((s) => s.viewedId);
  const detail = useRunView((s) => s.detail);
  const setOverlay = useRunOverlay((s) => s.set);
  const [socketDown, setSocketDown] = useState(false);
  const selectedFailure = useRef<string | null>(null);

  useEffect(() => {
    useRunView.getState().reset();
    selectedFailure.current = null;
    // A run that is going when the builder opens is shown at once.
    void listRuns(workflowId).then(
      ({ items }) => {
        useRunView.getState().setRuns(items);
        if (items[0] && isActive(items[0].status))
          useRunView.getState().view(items[0].id);
      },
      () => undefined,
    );
    const close = connectLive(workflowId, {
      onEvent: (event) => applyLiveEvent(workflowId, event),
      onOpen: () => {
        void refreshRuns(workflowId);
        const watched = useRunView.getState().viewedId;
        if (watched) void refreshDetail(watched);
      },
      onDown: setSocketDown,
    });
    return () => {
      close();
      useRunView.getState().reset();
      setOverlay({});
    };
  }, [workflowId, setOverlay]);

  // A run picked in the drawer (or followed) is loaded once; the socket keeps it current after that.
  useEffect(() => {
    if (viewedId) void refreshDetail(viewedId);
  }, [viewedId]);

  // Fallback while the socket is down: poll the watched run until it ends.
  useEffect(() => {
    if (!socketDown || !viewedId) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (!isActive(useRunView.getState().detail?.status)) return;
      void refreshDetail(viewedId);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [socketDown, viewedId]);

  // Each block shows its state from the watched run; a failed block is selected once so its error is in view.
  useEffect(() => {
    const steps = detail?.steps ?? [];
    setOverlay(
      Object.fromEntries(steps.map((s) => [s.nodeId, s.status as StepState])),
    );
    if (
      detail?.status === "failed" &&
      detail.failedNodeId &&
      selectedFailure.current !== detail.id
    ) {
      selectedFailure.current = detail.id;
      useBuilder.getState().select(detail.failedNodeId);
    }
  }, [detail, setOverlay]);
}
