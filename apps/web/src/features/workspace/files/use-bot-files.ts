"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteFile,
  type LibraryFile,
  listFiles,
} from "@/features/files/api/library";

/** This bot's stored files, newest first: loaded when the Files tab opens, then on Refresh, Load more and delete. */
export function useBotFiles(botId: string) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

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
    [botId],
  );

  useEffect(() => void load(true), [load]);

  /** Deletes on the server first; the list only changes when that worked. */
  const remove = useCallback(async (id: string) => {
    await deleteFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

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
