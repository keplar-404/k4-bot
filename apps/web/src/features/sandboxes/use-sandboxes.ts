"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  deleteSandbox,
  listSandboxes,
  pauseSandbox,
  type SandboxList,
  startSandbox,
} from "./api";

export type SandboxAction = "start" | "pause" | "delete";
const CALLS = {
  start: startSandbox,
  pause: pauseSandbox,
  delete: deleteSandbox,
} as const;

/** The user's sandboxes and limits; actions run one at a time per bot, then the list reloads. */
export function useSandboxes() {
  const [data, setData] = useState<SandboxList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      listSandboxes()
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => void reload(), [reload]);

  const act = async (action: SandboxAction, botId: string) => {
    setBusy(botId);
    try {
      await CALLS[action](botId);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return { data, error, busy, act, reload };
}
