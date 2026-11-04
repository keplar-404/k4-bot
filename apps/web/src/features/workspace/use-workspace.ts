"use client";

import { createContext, useContext } from "react";
import type { WorkspaceApi } from "./types";

export const WorkspaceContext = createContext<WorkspaceApi | null>(null);

/** The bot page's workspace (tabs of the side bar). Throws outside WorkspaceProvider. */
export function useWorkspace(): WorkspaceApi {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/** The workspace when there is one (the bot page), null elsewhere (e.g. the Files page): for optional "Open" buttons. */
export const useOptionalWorkspace = (): WorkspaceApi | null =>
  useContext(WorkspaceContext);
