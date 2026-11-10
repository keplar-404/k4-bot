"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useSandboxesStore } from "./store";

export type { SandboxAction } from "./store";

/** The user's sandboxes and limits from the shared store (reloaded when the page opens). */
export function useSandboxes() {
  const state = useSandboxesStore(
    useShallow((s) => ({
      data: s.data,
      error: s.error,
      busy: s.busy,
      act: s.act,
      reload: s.reload,
    })),
  );
  const { reload } = state;
  useEffect(() => void reload(), [reload]);
  return state;
}
