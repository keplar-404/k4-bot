import type { PickableKind, WorkspaceTab } from "./types";

/** The side bar's tab rules as pure functions (checked in workspace-state.check.ts), and their per-browser storage. */

export type WorkspaceState = { tabs: WorkspaceTab[]; activeId: string };

export const START_ID = "start";
export const startTab = (id: string): WorkspaceTab => ({
  id,
  kind: "start",
  title: "Start",
});
export const TOOLS: Record<PickableKind, WorkspaceTab> = {
  computer: { id: "computer", kind: "computer", title: "Computer" },
  browser: { id: "browser", kind: "browser", title: "Browser" },
  files: { id: "files", kind: "files", title: "Files" },
  code: { id: "code", kind: "code", title: "Code" },
};
export const INITIAL: WorkspaceState = {
  tabs: [startTab(START_ID)],
  activeId: START_ID,
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

/** Closing a background tab keeps the current one; closing the current one shows the tab before it. The last tab closed leaves a Start tab. */
export function closeTab(s: WorkspaceState, id: string): WorkspaceState {
  const i = s.tabs.findIndex((t) => t.id === id);
  if (i < 0) return s;
  const tabs = s.tabs.filter((t) => t.id !== id);
  if (tabs.length === 0) return INITIAL;
  return {
    tabs,
    activeId: s.activeId === id ? tabs[Math.max(0, i - 1)].id : s.activeId,
  };
}

/** A new Start tab, shown. */
export function newStart(s: WorkspaceState, id: string): WorkspaceState {
  return addTab(s, startTab(id));
}

/** The Start tab becomes the chosen tool in the same place; a tool already open is shown instead. */
export function pickTool(
  s: WorkspaceState,
  startId: string,
  kind: PickableKind,
  browserId: string,
): WorkspaceState {
  const tool =
    kind === "browser" ? { ...TOOLS.browser, id: browserId } : TOOLS[kind];
  if (s.tabs.some((t) => t.id === tool.id)) {
    return { ...closeTab(s, startId), activeId: tool.id };
  }
  return {
    tabs: s.tabs.map((t) => (t.id === startId ? tool : t)),
    activeId: tool.id,
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
    const tabs = saved.tabs.slice(-(MAX_FILE_TABS + 8));
    if (tabs.length === 0) return INITIAL;
    return {
      tabs,
      activeId: tabs.some((t) => t.id === saved.activeId)
        ? saved.activeId
        : tabs[0].id,
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

const SIDEBAR_KEY = "k4.sidebarOpen";

/** The right side bar's saved open/closed choice in this browser (it starts open). */
export function readSidebarOpen(): boolean {
  try {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved === null) {
      localStorage.setItem(SIDEBAR_KEY, "true"); // the first visit starts open
      return true;
    }
    return saved !== "false";
  } catch {
    return true; // private mode or full storage: it just starts open
  }
}

/** Keeps the right side bar's open/closed choice for the next visit. */
export function saveSidebarOpen(open: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, String(open));
  } catch {
    // private mode or full storage: the choice is simply not remembered
  }
}
