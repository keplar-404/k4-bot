"use client";

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from "react";
import { SandboxApiError, saveFile } from "./api";
import type { Doc } from "./types";

/**
 * Saving the open file. `save` writes over the version it was loaded from: if the sandbox has a newer one (the bot
 * changed it), the draft is kept and `stale` asks the user. `overwrite` keeps the user's draft anyway.
 */
export function useDocSave(
  botId: string,
  doc: RefObject<Doc | null>,
  setDoc: Dispatch<SetStateAction<Doc | null>>,
  setStale: (stale: boolean) => void,
  setError: (error: string | null) => void,
) {
  const write = useCallback(
    async (force: boolean) => {
      const d = doc.current;
      if (!d || (!force && d.text === d.saved)) return;
      try {
        const hash = await saveFile(
          botId,
          d.path,
          d.text,
          force ? null : d.hash,
        );
        setDoc({ ...d, saved: d.text, hash });
        setStale(false);
      } catch (e) {
        if (e instanceof SandboxApiError && e.code === "CONFLICT")
          setStale(true);
        else setError((e as Error).message);
      }
    },
    [botId, doc, setDoc, setStale, setError],
  );
  return { save: () => write(false), overwrite: () => write(true) };
}
