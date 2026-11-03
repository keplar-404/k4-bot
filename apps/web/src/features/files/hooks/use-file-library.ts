"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteFile, type LibraryFile, listFiles } from "@/features/files/api";

/** The user's stored files, page by page, and deleting one after the user confirmed it. */
export function useFileLibrary() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [deleting, setDeleting] = useState<LibraryFile | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (after: string | null) => {
    try {
      const page = await listFiles(after);
      setFiles((current) => (after ? [...current, ...page.files] : page.files));
      setCursor(page.nextCursor);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, []);

  useEffect(() => {
    void load(null).finally(() => setLoading(false));
  }, [load]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteFile(deleting.id);
      setFiles((current) => current.filter((f) => f.id !== deleting.id));
      setDeleting(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const loadMore = () => {
    if (!cursor) return;
    setMore(true);
    void load(cursor).finally(() => setMore(false));
  };

  return {
    files,
    cursor,
    loading,
    more,
    loadMore,
    deleting,
    setDeleting,
    busy,
    confirmDelete,
  };
}
