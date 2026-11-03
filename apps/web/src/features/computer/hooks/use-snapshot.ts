"use client";

import { useEffect, useState } from "react";
import { snapshotUrl } from "@/features/computer/api";

/** The screen saved when the computer last slept, as an object URL (freed when a newer one replaces it). */
export function useSnapshot(snapshotAt: number | undefined) {
  const [snapshot, setSnapshot] = useState<string | null>(null);
  // Fetched once per save (its time is in the URL, so the browser caches it).
  useEffect(() => {
    if (!snapshotAt) return;
    let url: string | null = null;
    let cancelled = false;
    void snapshotUrl(snapshotAt).then((u) => {
      if (cancelled && u) URL.revokeObjectURL(u);
      else {
        url = u;
        setSnapshot(u);
      }
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [snapshotAt]);
  return snapshot;
}
