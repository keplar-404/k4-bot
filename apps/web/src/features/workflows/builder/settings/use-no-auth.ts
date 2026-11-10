"use client";

import { useEffect } from "react";
import { fetchCatalog } from "@/features/connect/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/** Whether this app needs no login (from the catalog), so the block can skip the Connect box. */
export function useNoAuth(toolkit: string) {
  const [{ noAuth }, , store] = useLocalStore(() => ({
    noAuth: false,
  }));
  const setNoAuth = fieldSetter(store, "noAuth");
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
  }, [toolkit, setNoAuth]);
  return noAuth;
}
