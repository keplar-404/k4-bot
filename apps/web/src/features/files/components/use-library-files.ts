"use client";

import { useState } from "react";
import { type LibraryFile, listFiles } from "../api/library";

/** The Files page's files, a page at a time: `load(null)` starts over, `load(cursor)` adds the next page. */
export function useLibraryFiles() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (from: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const page = await listFiles(from);
      setFiles((prev) => (from ? [...prev, ...page.files] : page.files));
      setCursor(page.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return { files, cursor, loading, error, load };
}
