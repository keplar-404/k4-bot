/** A stored file opened in the workspace (what the preview needs). */
export type WorkspaceFile = { id: string; name: string; mimeType: string };

/** One tab of the bot page's side bar: the fixed Computer / Browser / Files tabs, extra browser tabs, and files. */
export type WorkspaceTab =
  | { id: string; kind: "computer" | "files" | "code"; title: string }
  | { id: string; kind: "start"; title: string }
  | { id: string; kind: "browser"; title: string; url?: string }
  | { id: string; kind: "file"; title: string; file: WorkspaceFile };

export type PickableKind = "computer" | "browser" | "files" | "code";

export interface WorkspaceApi {
  tabs: WorkspaceTab[];
  activeId: string;
  open: (file: WorkspaceFile) => void;
  openUrl: (url: string) => void;
  close: (id: string) => void;
  setActive: (id: string) => void;
  /** Opens a new Start tab (the picker of what to open). */
  newTab: () => void;
  /** Turns the Start tab `startId` into the chosen tool (or shows it if already open). */
  pick: (startId: string, kind: PickableKind) => void;
  /** Whether the right side bar is shown (a panel on wide screens, a sheet on narrow ones). */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  /** Sets the side bar state without writing to storage (used for auto-init on load). */
  setSidebarOpenState: (open: boolean) => void;
  /** The full-page code editor over this bot's sandbox (not remembered: it wakes the sandbox). */
  editorOpen: boolean;
  setEditorOpen: (open: boolean) => void;
}
