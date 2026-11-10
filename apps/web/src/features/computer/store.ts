"use client";

import { create } from "zustand";
import { ChatHttpError } from "@/features/chat/lib/client";
import {
  type ActivityEvent,
  type ComputerStatus,
  closeComputer,
  getStatus,
  releaseControl,
  takeControl,
  type WorkingBot,
  wake,
  wrapUp,
} from "./api";

export type ComputerAction = "wake" | "pause" | "wrap" | "take" | "release";

const MAX_ACTIVITY = 50;

/**
 * The user's computer, shared by every view on the page (bot panel, chat, VM page). The status socket
 * (`hooks/use-computer-socket.ts`) writes here; components read with selectors and re-render on each update.
 */
type ComputerState = {
  status: ComputerStatus | null;
  activity: ActivityEvent[];
  /** The action in flight, so its button can show a spinner while the others are disabled. */
  pending: ComputerAction | null;
  error: string | null;
  /** Local clock time the session ends, from the server's "ms left" (immune to clock skew). */
  sessionEndsAt: number | null;
  /** Bots that were using the computer when the user tried to put it to sleep: the page asks before going on. */
  blockers: { bots: WorkingBot[]; at: number } | null;
  /** The screen saved when the computer last slept (object URL). */
  snapshot: string | null;

  applyStatus: (s: ComputerStatus) => void;
  pushActivity: (e: ActivityEvent) => void;
  setActivity: (events: ActivityEvent[]) => void;
  setSnapshot: (url: string | null) => void;
  dismissBlockers: () => void;
  wake: () => Promise<void>;
  pause: (force?: boolean) => Promise<void>;
  wrapUp: () => Promise<void>;
  takeControl: () => Promise<void>;
  releaseControl: () => Promise<void>;
};

export const useComputerStore = create<ComputerState>()((set, get) => {
  /** Shows the action as pending and reports its error. */
  const run = async (name: ComputerAction, action: () => Promise<unknown>) => {
    set({ pending: name, error: null });
    try {
      await action();
    } catch (e) {
      set({
        error:
          e instanceof ChatHttpError ? e.info.message : "Something went wrong.",
      });
    } finally {
      set({ pending: null });
    }
  };

  return {
    status: null,
    activity: [],
    pending: null,
    error: null,
    sessionEndsAt: null,
    blockers: null,
    snapshot: null,

    applyStatus: (s) =>
      set({
        status: s,
        sessionEndsAt: s.session ? Date.now() + s.session.endsInMs : null,
      }),
    pushActivity: (e) =>
      set((st) => ({
        activity: [...st.activity.slice(-(MAX_ACTIVITY - 1)), e],
      })),
    setActivity: (events) => set({ activity: events }),
    setSnapshot: (url) => {
      const old = get().snapshot;
      if (old && old !== url) URL.revokeObjectURL(old);
      set({ snapshot: url });
    },
    dismissBlockers: () => set({ blockers: null }),

    wake: () =>
      run("wake", async () => {
        // Show "starting" at once; the server's own status replaces it within moments.
        set((st) => ({
          status: st.status
            ? {
                ...st.status,
                state: "starting",
                message: "Waking your computer…",
              }
            : st.status,
        }));
        try {
          get().applyStatus(await wake());
        } catch (e) {
          // Do not leave the optimistic "starting" behind.
          void getStatus()
            .then(get().applyStatus)
            .catch(() => undefined);
          throw e;
        }
      }),
    pause: (force = false) =>
      run("pause", async () => {
        const result = await closeComputer(force);
        if (result.closed) {
          set({ blockers: null });
          get().applyStatus(result.status);
        } else set({ blockers: { bots: result.working, at: Date.now() } });
      }),
    wrapUp: () =>
      run("wrap", async () => {
        set({ blockers: null });
        get().applyStatus(await wrapUp());
      }),
    takeControl: () =>
      run("take", async () => {
        const result = await takeControl();
        if (!result.ok)
          set({ error: result.message ?? "Could not take control." });
      }),
    releaseControl: () => run("release", releaseControl),
  };
});
