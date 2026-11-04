"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { BASE } from "@/features/files/api/library";
import {
  deleteSandbox,
  pauseSandbox,
  type SandboxRow,
  startSandbox,
} from "@/features/sandboxes/api";

type Row = Omit<SandboxRow, "botName">;

/** This bot's sandbox (null when it has none yet) and the actions on it; reloads after each action. */
export function useBotSandbox(botId: string) {
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`${BASE}/api/v1/sandbox/${botId}`, {
      credentials: "include",
    });
    if (res.status === 401) redirectToSignIn();
    const body = (await res.json().catch(() => null)) as {
      sandbox?: Row | null;
    } | null;
    setRow(res.ok ? (body?.sandbox ?? null) : null);
  }, [botId]);

  useEffect(() => void reload(), [reload]);

  const run =
    (call: (id: string) => Promise<unknown>, done: string) => async () => {
      setBusy(true);
      try {
        await call(botId);
        toast.success(done);
        await reload();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    };

  return {
    row,
    busy,
    reload,
    start: run(startSandbox, "Sandbox running"),
    pause: run(pauseSandbox, "Sandbox paused; its files are kept"),
    remove: run(deleteSandbox, "Sandbox deleted"),
  };
}
