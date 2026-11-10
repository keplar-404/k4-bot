"use client";

import { create } from "zustand";
import {
  INITIAL,
  readSidebarOpen,
  restoreState,
  saveSidebarOpen,
  saveState,
} from "./workspace-state";

type TabsState = typeof INITIAL;

/**
 * The bot page's side bar: its tabs (per bot, remembered in this browser), whether it is open, and whether the code
 * editor is open. One store, so every panel that opens a file or a page updates the same side bar.
 */
type WorkspaceState = {
  botId: string | null;
  tabs: TabsState;
  editorOpen: boolean;
  sidebarOpen: boolean;
  /** Switches to a bot's saved tabs (and the saved side bar choice, read after mount to keep hydration stable). */
  bind: (botId: string) => void;
  /** Changes the tabs and saves them for this bot. */
  setTabs: (update: (s: TabsState) => TabsState) => void;
  setEditorOpen: (open: boolean) => void;
  /** Opens or closes the side bar and remembers the choice. */
  setSidebarOpen: (open: boolean) => void;
  /** Opens or closes it for now only (e.g. on a small screen). */
  setSidebarOpenState: (open: boolean) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  botId: null,
  tabs: INITIAL,
  editorOpen: false,
  // A server-safe default; the saved value is read in `bind` (after mount).
  sidebarOpen: true,

  bind: (botId) =>
    set({
      botId,
      tabs: restoreState(botId),
      editorOpen: false,
      sidebarOpen: readSidebarOpen(),
    }),
  setTabs: (update) => {
    const tabs = update(get().tabs);
    set({ tabs });
    const { botId } = get();
    if (botId) saveState(botId, tabs);
  },
  setEditorOpen: (editorOpen) => set({ editorOpen }),
  setSidebarOpen: (sidebarOpen) => {
    set({ sidebarOpen });
    saveSidebarOpen(sidebarOpen);
  },
  setSidebarOpenState: (sidebarOpen) => set({ sidebarOpen }),
}));
