"use client";

import { useSyncExternalStore } from "react";

/** Opening the dialog from anywhere (the sidebar's Skills and MCP items). */
export type IntegrationsTab = "skills" | "mcp";
type DialogState = { open: boolean; tab: IntegrationsTab };
let dialog: DialogState = { open: false, tab: "skills" };
const dialogListeners = new Set<() => void>();
const setDialog = (next: DialogState) => {
  dialog = next;
  for (const l of dialogListeners) l();
};

export const openIntegrations = (tab: IntegrationsTab) =>
  setDialog({ open: true, tab });

export function useIntegrationsDialog() {
  const value = useSyncExternalStore(
    (l) => {
      dialogListeners.add(l);
      return () => dialogListeners.delete(l);
    },
    () => dialog,
    () => dialog,
  );
  return {
    ...value,
    setOpen: (open: boolean) => setDialog({ ...dialog, open }),
    setTab: (tab: IntegrationsTab) => setDialog({ ...dialog, tab }),
  };
}
