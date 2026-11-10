"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLocalStore } from "@/lib/store/local-store";
import { type CatalogApp, fetchCatalog } from "./api";

const PAGE = 50;

export type CatalogFilters = {
  q: string;
  category: string | null;
  slugs: string[] | null;
  /** Only apps that have events (for the App event trigger). */
  withTriggers?: boolean;
  /** Only apps that need no account. */
  noAuth?: boolean;
};

/**
 * The catalog for the current filters, a page at a time. Typing waits 250 ms before searching, and an answer for an
 * older search is dropped, so fast typing never shows a stale list.
 */
export function useCatalog(filters: CatalogFilters) {
  const [{ items, total, loading, error }, set] = useLocalStore(() => ({
    items: [] as CatalogApp[],
    total: 0,
    loading: true,
    error: null as string | null,
  }));
  const controller = useRef<AbortController | null>(null);
  const slugKey = filters.slugs?.join(",") ?? null;

  const load = useCallback(
    async (offset: number) => {
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      set({ loading: true, error: null });
      try {
        const slugs =
          slugKey === null ? undefined : slugKey ? slugKey.split(",") : [];
        const page = await fetchCatalog(
          {
            q: filters.q.trim() || undefined,
            category: filters.category ?? undefined,
            slugs,
            withTriggers: filters.withTriggers,
            noAuth: filters.noAuth,
            offset,
            limit: PAGE,
          },
          ac.signal,
        );
        set((s) => ({
          items: offset === 0 ? page.items : [...s.items, ...page.items],
          total: page.total,
        }));
      } catch (e) {
        if (!ac.signal.aborted) set({ error: (e as Error).message });
      } finally {
        if (!ac.signal.aborted) set({ loading: false });
      }
    },
    [filters.q, filters.category, filters.withTriggers, filters.noAuth, slugKey, set],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(0), filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  useEffect(() => () => controller.current?.abort(), []);

  return {
    items,
    total,
    loading,
    error,
    hasMore: items.length < total,
    loadMore: () => void load(items.length),
    retry: () => void load(0),
  };
}
