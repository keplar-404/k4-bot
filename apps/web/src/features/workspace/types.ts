/** A stored file opened in the workspace (what the preview needs). */
export type WorkspaceFile = { id: string; name: string; mimeType: string };

/** One tab of the bot page's side bar: the fixed Computer / Browser / Files tabs, extra browser tabs, and files. */
export type WorkspaceTab =
  | {
      id: "computer" | "browser" | "files" | "code";
      kind: "computer" | "browser" | "files" | "code";
      title: string;
    }
  | { id: string; kind: "browser"; title: string; url: string }
  | { id: string; kind: "file"; title: string; file: WorkspaceFile };

export interface WorkspaceApi {
  tabs: WorkspaceTab[];
  activeId: string;
  open: (file: WorkspaceFile) => void;
  openUrl: (url: string) => void;
  close: (id: string) => void;
  setActive: (id: string) => void;
  /** The full-page code editor over this bot's sandbox (not remembered: it wakes the sandbox). */
  editorOpen: boolean;
  setEditorOpen: (open: boolean) => void;
}
