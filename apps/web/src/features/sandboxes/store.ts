"use client";

import { toast } from "sonner";
import { create } from "zustand";
import {
  deleteSandbox,
  listSandboxes,
  pauseSandbox,
  type SandboxList,
  startSandbox,
} from "./api";

export type SandboxAction = "start" | "pause" | "delete";
const CALLS = {
  start: startSandbox,
  pause: pauseSandbox,
  delete: deleteSandbox,
} as const;

/** The user's sandboxes and limits, shared; an action runs one at a time per bot, then the list reloads. */
type SandboxesState = {
  data: SandboxList | null;
  error: string | null;
  /** The bot whose sandbox action is in flight. */
  busy: string | null;
  reload: () => Promise<void>;
  act: (action: SandboxAction, botId: string) => Promise<void>;
};

export const useSandboxesStore = create<SandboxesState>()((set, get) => ({
  data: null,
  error: null,
  busy: null,
  reload: () =>
    listSandboxes()
      .then((data) => set({ data, error: null }))
      .catch((e: Error) => set({ error: e.message })),
  act: async (action, botId) => {
    set({ busy: botId });
    try {
      await CALLS[action](botId);
      await get().reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },
}));
