"use client";

import { useEffect } from "react";
import { snapshotUrl } from "@/features/computer/api";
import { useComputerStore } from "@/features/computer/store";

/** Loads the screen saved when the computer last slept into the shared store (the old object URL is freed). */
export function useSnapshot(snapshotAt: number | undefined) {
  // Fetched once per save (its time is in the URL, so the browser caches it).
  useEffect(() => {
    if (!snapshotAt) return;
    let cancelled = false;
    void snapshotUrl(snapshotAt).then((u) => {
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
      } else useComputerStore.getState().setSnapshot(u);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshotAt]);
}
