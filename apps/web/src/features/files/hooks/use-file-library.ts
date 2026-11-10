"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useFilesStore } from "@/features/files/store";

/** The user's stored files from the shared store, page by page, and deleting one after the user confirmed it. */
export function useFileLibrary() {
  const { load, error, ...state } = useFilesStore(
    useShallow((s) => ({
      files: s.files,
      cursor: s.cursor,
      loading: s.loading,
      more: s.more,
      error: s.error,
      deleting: s.deleting,
      setDeleting: s.setDeleting,
      busy: s.busy,
      confirmDelete: s.confirmDelete,
      load: s.load,
    })),
  );
  useEffect(() => void load(null), [load]);
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);
  return {
    ...state,
    loadMore: () => {
      const { cursor, more } = useFilesStore.getState();
      if (cursor && !more) void load(cursor);
    },
  };
}
