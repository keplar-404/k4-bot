"use client";

import {
  CircleAlertIcon,
  CircleCheckIcon,
  HourglassIcon,
  Loader2Icon,
  MinusCircleIcon,
  RepeatIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { create } from "zustand";
import { useBuilder } from "./store";

export type StepState =
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "skipped"
  | "waiting";

/** The run being shown on the canvas: each block's state, by block id (filled by the run viewer). */
export const useRunOverlay = create<{
  steps: Record<string, StepState>;
  set: (steps: Record<string, StepState>) => void;
}>((set) => ({
  steps: {},
  set: (steps) => set({ steps }),
}));

const LOOK: Record<StepState, { ring: string; icon: ReactNode }> = {
  running: {
    ring: "ring-2 ring-sky-500",
    icon: (
      <Loader2Icon
        className="size-4 shrink-0 animate-spin text-sky-500"
        aria-label="Running"
      />
    ),
  },
  retrying: {
    ring: "ring-2 ring-amber-500",
    icon: (
      <RepeatIcon
        className="size-4 shrink-0 text-amber-500"
        aria-label="Retrying"
      />
    ),
  },
  waiting: {
    ring: "ring-2 ring-sky-500/60",
    icon: (
      <HourglassIcon
        className="size-4 shrink-0 text-sky-500"
        aria-label="Waiting"
      />
    ),
  },
  succeeded: {
    ring: "ring-2 ring-emerald-500",
    icon: (
      <CircleCheckIcon
        className="size-4 shrink-0 text-emerald-500"
        aria-label="Succeeded"
      />
    ),
  },
  failed: {
    ring: "ring-2 ring-destructive",
    icon: (
      <CircleAlertIcon
        className="size-4 shrink-0 text-destructive"
        aria-label="Failed"
      />
    ),
  },
  skipped: {
    ring: "opacity-60",
    icon: (
      <MinusCircleIcon
        className="size-4 shrink-0 text-muted-foreground"
        aria-label="Skipped"
      />
    ),
  },
};

/** What a block shows on top of itself: a live run's state, else whether its setup is unfinished. */
export function useNodeOverlay(id: string): {
  ring: string;
  icon: ReactNode;
  issue: string | null;
} {
  const step = useRunOverlay((s) => s.steps[id]);
  const issue = useBuilder(
    (s) => s.workflow?.issues.find((i) => i.nodeId === id)?.message ?? null,
  );
  return step ? { ...LOOK[step], issue } : { ring: "", icon: null, issue };
}
