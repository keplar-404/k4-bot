import type { WorkspaceTab } from "./types";

/** The side bar's tab rules as pure functions (checked in workspace-state.check.ts), and their per-browser storage. */

export type WorkspaceState = { tabs: WorkspaceTab[]; activeId: string };

export const FIXED_TABS: WorkspaceTab[] = [
  { id: "computer", kind: "computer", title: "Computer" },
  { id: "browser", kind: "browser", title: "Browser" },
  { id: "files", kind: "files", title: "Files" },
  { id: "code", kind: "code", title: "Code" },
];
export const INITIAL: WorkspaceState = {
  tabs: FIXED_TABS,
  activeId: "computer",
};

/** Older file tabs close when more are opened. */
export const MAX_FILE_TABS = 8;

/** Opens a tab (or shows it again when it is already open), closing the oldest file tab past the limit. */
export function addTab(s: WorkspaceState, tab: WorkspaceTab): WorkspaceState {
  if (s.tabs.some((t) => t.id === tab.id)) return { ...s, activeId: tab.id };
  const tabs = [...s.tabs, tab];
  const oldest =
    tabs.filter((t) => t.kind === "file").length > MAX_FILE_TABS
      ? tabs.find((t) => t.kind === "file")
      : undefined;
  return {
    tabs: oldest ? tabs.filter((t) => t.id !== oldest.id) : tabs,
    activeId: tab.id,
  };
}

/** Closing a background tab keeps the current one; closing the current one shows the tab before it. */
export function closeTab(s: WorkspaceState, id: string): WorkspaceState {
  if (FIXED_TABS.some((f) => f.id === id)) return s;
  const i = s.tabs.findIndex((t) => t.id === id);
  const tabs = s.tabs.filter((t) => t.id !== id);
  return {
    tabs,
    activeId:
      s.activeId === id
        ? (tabs[Math.max(0, i - 1)]?.id ?? "computer")
        : s.activeId,
  };
}

const key = (botId: string) => `k4.workspace.${botId}`;

/** This bot's saved tabs, or the defaults (private mode, cleared storage or bad data just start fresh). */
export function restoreState(botId: string): WorkspaceState {
  try {
    const saved = JSON.parse(
      localStorage.getItem(key(botId)) ?? "null",
    ) as WorkspaceState | null;
    if (!saved || !Array.isArray(saved.tabs)) return INITIAL;
    const tabs = [
      ...FIXED_TABS,
      ...saved.tabs
        .filter((t) => !FIXED_TABS.some((f) => f.id === t.id))
        .slice(-MAX_FILE_TABS),
    ];
    return {
      tabs,
      activeId: tabs.some((t) => t.id === saved.activeId)
        ? saved.activeId
        : "computer",
    };
  } catch {
    return INITIAL;
  }
}

export function saveState(botId: string, s: WorkspaceState) {
  try {
    localStorage.setItem(key(botId), JSON.stringify(s));
  } catch {
    // private mode or full storage: the tabs are simply not remembered
  }
}
