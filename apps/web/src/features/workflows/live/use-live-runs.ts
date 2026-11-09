"use client";

import { useEffect, useRef, useState } from "react";
import { listRuns } from "../api";
import { applyLiveEvent, refreshDetail, refreshRuns } from "./live-events";

export { refreshRuns } from "./live-events";

import { type StepState, useRunOverlay } from "../builder/node-overlay";
import { useBuilder } from "../builder/store";
import { connectLive } from "./live-socket";
import { isActive, useRunView } from "./run-view-store";

const POLL_MS = 2000;

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
