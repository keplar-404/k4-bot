"use client";

import { type ReactNode, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore } from "./store";
import type { WorkspaceApi, WorkspaceFile } from "./types";
import { WorkspaceContext } from "./use-workspace";
import { addTab, closeTab, newStart, pickTool } from "./workspace-state";

/** The bot page's side-bar tabs from the workspace store: which are open and which is shown, remembered per bot. */
export function WorkspaceProvider({
  botId,
  children,
}: {
  botId: string;
  children: ReactNode;
}) {
  const s = useWorkspaceStore(
    useShallow((st) => ({
      tabs: st.tabs,
      editorOpen: st.editorOpen,
      sidebarOpen: st.sidebarOpen,
      bind: st.bind,
      setTabs: st.setTabs,
      setEditorOpen: st.setEditorOpen,
      setSidebarOpen: st.setSidebarOpen,
      setSidebarOpenState: st.setSidebarOpenState,
    })),
  );
  const { bind } = s;
  useEffect(() => bind(botId), [bind, botId]);

  const api = useMemo<WorkspaceApi>(
    () => ({
      ...s.tabs,
      open: (file: WorkspaceFile) => {
        s.setSidebarOpen(true);
        s.setTabs((t) =>
          addTab(t, {
            id: file.id,
            kind: "file",
            title: file.name,
            file: { id: file.id, name: file.name, mimeType: file.mimeType },
          }),
        );
      },
      openUrl: (url: string) =>
        s.setTabs((t) =>
          addTab(t, {
            id: `browser-${Date.now()}`,
            kind: "browser",
            title: new URL(url).hostname,
            url,
          }),
        ),
      close: (id: string) => s.setTabs((t) => closeTab(t, id)),
      newTab: () => s.setTabs((t) => newStart(t, `start-${Date.now()}`)),
      pick: (startId, kind) =>
        s.setTabs((t) => pickTool(t, startId, kind, `browser-${Date.now()}`)),
      setActive: (activeId: string) => s.setTabs((t) => ({ ...t, activeId })),
      sidebarOpen: s.sidebarOpen,
      setSidebarOpen: s.setSidebarOpen,
      setSidebarOpenState: s.setSidebarOpenState,
      editorOpen: s.editorOpen,
      setEditorOpen: s.setEditorOpen,
    }),
    [s],
  );

  return (
    <WorkspaceContext.Provider value={api}>
      {children}
    </WorkspaceContext.Provider>
  );
}
