"use client";

import { useEffect } from "react";
import { fileUrl } from "@/features/files/api/library";
import { useLocalStore } from "@/lib/store/local-store";

/** Stored files never change, so each is fetched once per page load; a failed fetch is forgotten so it can be retried. */
const cache = new Map<string, Promise<Blob>>();

function load(file: { id: string; mimeType: string }): Promise<Blob> {
  const hit = cache.get(file.id);
  if (hit) return hit;
  const p = fetch(fileUrl(file.id, true), { credentials: "include" }).then(
    async (res) => {
      if (!res.ok)
        throw new Error(
          res.status === 404
            ? "This file no longer exists."
            : "Couldn't load the file. Try again.",
        );
      return new Blob([await res.blob()], { type: file.mimeType });
    },
  );
  cache.set(file.id, p);
  p.catch(() => cache.delete(file.id));
  return p;
}

/** The file's bytes as a Blob plus an object URL for viewers; the URL is revoked when the view goes away. */
export function useFileBlob(file: { id: string; mimeType: string }) {
  const [state, setState] = useLocalStore<{
    blob: Blob | null;
    url: string | null;
    error: string | null;
  }>(() => ({ blob: null, url: null, error: null }));

  useEffect(() => {
    let url: string | null = null;
    let live = true;
    setState({ blob: null, url: null, error: null });
    load({ id: file.id, mimeType: file.mimeType })
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setState({ blob, url, error: null });
      })
      .catch(
        (e: Error) =>
          live && setState({ blob: null, url: null, error: e.message }),
      );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, file.mimeType, setState]);

  return state;
}
