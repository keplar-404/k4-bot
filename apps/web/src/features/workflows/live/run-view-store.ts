"use client";

import { create } from "zustand";
import type { LiveEvent, RunDetail, RunStatus, RunSummary } from "../types";

type StepEvent = Extract<LiveEvent, { type: "step" }>;

export const isActive = (status: RunStatus | undefined) =>
  status === "queued" || status === "running";

/** The runs of the open workflow and the one being watched. The database is the truth; this only mirrors it. */
export const useRunView = create<{
  runs: RunSummary[];
  viewedId: string | null;
  detail: RunDetail | null;
  setRuns: (runs: RunSummary[]) => void;
  view: (id: string | null) => void;
  setDetail: (detail: RunDetail | null) => void;
  /** A step change from the live socket, applied to the watched run until its full detail is reloaded. */
  applyStep: (event: StepEvent) => void;
  reset: () => void;
}>((set) => ({
  runs: [],
  viewedId: null,
  detail: null,
  setRuns: (runs) => set({ runs }),
  view: (id) =>
    set((s) => ({
      viewedId: id,
      detail: s.detail?.id === id ? s.detail : null,
    })),
  setDetail: (detail) => set({ detail }),
  applyStep: (event) =>
    set((s) => {
      if (!s.detail || s.detail.id !== event.runId) return {};
      const step = {
        nodeId: event.nodeId,
        nodeKind: event.nodeKind,
        status: event.status,
        attempt: event.attempt,
        error: event.error ?? null,
      };
      const known = s.detail.steps.some((x) => x.nodeId === event.nodeId);
      const steps = known
        ? s.detail.steps.map((x) =>
            x.nodeId === event.nodeId ? { ...x, ...step } : x,
          )
        : [...s.detail.steps, step];
      return { detail: { ...s.detail, status: "running", steps } };
    }),
  reset: () => set({ runs: [], viewedId: null, detail: null }),
}));
