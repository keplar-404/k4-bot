"use client";

import { useShallow } from "zustand/react/shallow";
import { useFilesStore } from "../store";

/** The user's files from the shared store: `load(null)` starts over, `load(cursor)` adds the next page. */
export function useLibraryFiles() {
  return useFilesStore(
    useShallow((s) => ({
      files: s.files,
      cursor: s.cursor,
      loading: s.loading || s.more,
      error: s.error,
      load: s.load,
    })),
  );
}
