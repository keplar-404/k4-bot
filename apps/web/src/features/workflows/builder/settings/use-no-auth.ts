"use client";

import { useEffect, useState } from "react";
import { fetchCatalog } from "@/features/connect/api";

/** Whether this app needs no login (from the catalog), so the block can skip the Connect box. */
export function useNoAuth(toolkit: string) {
  const [noAuth, setNoAuth] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setNoAuth(false);
    if (!toolkit) return;
    fetchCatalog({ slugs: [toolkit], offset: 0, limit: 1 }).then(
      (page) => {
        if (!cancelled) setNoAuth(page.items[0]?.noAuth ?? false);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [toolkit]);
  return noAuth;
}
