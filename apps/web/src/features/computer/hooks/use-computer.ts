"use client";

import { useShallow } from "zustand/react/shallow";
import {
  type ComputerAction,
  useComputerStore,
} from "@/features/computer/store";
import { useComputerSocket } from "./use-computer-socket";
import { useKeepControl } from "./use-keep-control";
import { useSnapshot } from "./use-snapshot";

export type { ComputerAction };

/**
 * The user's computer from the shared store, plus the connection that keeps it live (one per page, through
 * `ComputerProvider`). Nothing here starts the computer by itself; only `wake()` does.
 */
export function useComputer() {
  const state = useComputerStore(
    useShallow((s) => ({
      status: s.status,
      activity: s.activity,
      pending: s.pending,
      error: s.error,
      sessionEndsAt: s.sessionEndsAt,
      blockers: s.blockers,
      snapshot: s.snapshot,
      dismissBlockers: s.dismissBlockers,
      wake: s.wake,
      pause: s.pause,
      wrapUp: s.wrapUp,
      takeControl: s.takeControl,
      releaseControl: s.releaseControl,
    })),
  );
  useComputerSocket();
  useSnapshot(state.status?.snapshotAt);
  const inControl = state.status?.lease?.kind === "user";
  useKeepControl(inControl);
  return { ...state, busy: state.pending !== null, inControl };
}

export type Computer = ReturnType<typeof useComputer>;
