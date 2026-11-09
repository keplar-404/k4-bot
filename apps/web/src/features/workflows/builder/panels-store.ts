"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Panels = {
  /** The block library on the left. */
  library: boolean;
  /** The settings on the right. Closed, selecting a block does not open it. */
  settings: boolean;
  shortcuts: boolean;
  /** The settings window widened to three columns (input, settings, output) on wide screens. */
  wide: boolean;
  toggle: (
    panel: "library" | "settings" | "shortcuts" | "wide",
    open?: boolean,
  ) => void;
};

/** Storage can throw (private windows, blocked site data): then the panels just start open. */
const safeStorage = createJSONStorage(() => ({
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not remembered this time.
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
}));

/** Which builder panels are open, remembered per browser (the shortcuts dialog is not remembered). */
export const usePanels = create<Panels>()(
  persist(
    (set) => ({
      library: true,
      settings: true,
      shortcuts: false,
      wide: false,
      toggle: (panel, open) => set((s) => ({ [panel]: open ?? !s[panel] })),
    }),
    {
      name: "workflow-builder-panels",
      storage: safeStorage,
      partialize: ({ library, settings, wide }) => ({
        library,
        settings,
        wide,
      }),
    },
  ),
);
