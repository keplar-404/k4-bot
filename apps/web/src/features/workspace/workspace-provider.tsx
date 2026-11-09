"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { WorkspaceApi, WorkspaceFile } from "./types";
import { WorkspaceContext } from "./use-workspace";
import {
  addTab,
  closeTab,
  INITIAL,
  newStart,
  pickTool,
  readSidebarOpen,
  restoreState,
  saveSidebarOpen,
  saveState,
} from "./workspace-state";

/** The bot page's side-bar tabs: which are open and which is shown, remembered per bot in this browser. */
export function WorkspaceProvider({
  botId,
  children,
}: {
  botId: string;
  children: ReactNode;
}) {
  const [state, setState] = useState(INITIAL);
  const [editorOpen, setEditorOpen] = useState(false);
  // Start from a server-safe default so SSR and the first client render agree;
  // the saved choice is read after mount to avoid a hydration mismatch.
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(true);
  useEffect(() => {
    setSidebarOpenState(readSidebarOpen());
  }, []);

  /** Every open/close of the right side bar is kept in this browser, so a reload starts it the same way. */
  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    saveSidebarOpen(open);
  }, []);

  useEffect(() => setState(restoreState(botId)), [botId]);
  useEffect(() => saveState(botId, state), [botId, state]);

  const api = useMemo<WorkspaceApi>(
    () => ({
      ...state,
      open: (file: WorkspaceFile) => {
        setSidebarOpen(true);
        setState((s) =>
          addTab(s, {
            id: file.id,
            kind: "file",
            title: file.name,
            file: { id: file.id, name: file.name, mimeType: file.mimeType },
          }),
        );
      },
      openUrl: (url: string) =>
        setState((s) =>
          addTab(s, {
            id: `browser-${Date.now()}`,
            kind: "browser",
            title: new URL(url).hostname,
            url,
          }),
        ),
      close: (id: string) => setState((s) => closeTab(s, id)),
      newTab: () => setState((s) => newStart(s, `start-${Date.now()}`)),
      pick: (startId, kind) =>
        setState((s) => pickTool(s, startId, kind, `browser-${Date.now()}`)),
      setActive: (activeId: string) => setState((s) => ({ ...s, activeId })),
      sidebarOpen,
      setSidebarOpen,
      setSidebarOpenState,
      editorOpen,
      setEditorOpen,
    }),
    [state, editorOpen, sidebarOpen, setSidebarOpen, setSidebarOpenState],
  );

  return (
    <WorkspaceContext.Provider value={api}>
      {children}
    </WorkspaceContext.Provider>
  );
}
