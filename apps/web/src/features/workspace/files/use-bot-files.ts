"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  deleteFile,
  type LibraryFile,
  listFiles,
} from "@/features/files/api/library";
import { useFilesStore } from "@/features/files/store";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/** This bot's stored files, newest first: loaded when the Files tab opens, then on Refresh, Load more and delete. */
export function useBotFiles(botId: string) {
  const [{ files, loading, error, hasMore }, , store] = useLocalStore(() => ({
    files: [] as LibraryFile[],
    loading: false,
    error: null as string | null,
    hasMore: false,
  }));
  const setFiles = fieldSetter(store, "files");
  const setLoading = fieldSetter(store, "loading");
  const setError = fieldSetter(store, "error");
  const setHasMore = fieldSetter(store, "hasMore");
  const cursor = useRef<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listFiles(reset ? null : cursor.current, botId);
        cursor.current = res.nextCursor;
        setHasMore(res.nextCursor !== null);
        setFiles((prev) => (reset ? res.files : [...prev, ...res.files]));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [botId, setError, setFiles, setHasMore, setLoading],
  );

  useEffect(() => void load(true), [load]);

  /** Deletes on the server first; the list only changes when that worked. */
  const remove = useCallback(
    async (id: string) => {
      await deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      // The Files page shows it gone too.
      useFilesStore.setState((st) => ({
        files: st.files.filter((f) => f.id !== id),
      }));
    },
    [setFiles],
  );

  return {
    files,
    loading,
    error,
    hasMore,
    refresh: () => load(true),
    loadMore: () => load(false),
    remove,
  };
}
