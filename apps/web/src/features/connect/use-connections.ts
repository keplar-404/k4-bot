"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  authorizeApp,
  type Connection,
  disconnectApp,
  fetchConnections,
} from "./api";

/** Statuses that mean the connection exists but stopped working: the app shows "Reconnect". */
const BROKEN = new Set(["EXPIRED", "FAILED", "INACTIVE", "REVOKED"]);

export type AppConnectionState =
  | { kind: "none" }
  | { kind: "active"; connections: Connection[] }
  | { kind: "broken"; connections: Connection[] };

/** The user's connections, grouped per app, with connect / disconnect. Unfinished link attempts are ignored. */
export function useConnections() {
  const [list, setList] = useState<Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      fetchConnections()
        .then((items) => {
          setList(items);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => void reload(), [reload]);

  const byApp = useMemo(() => {
    const map = new Map<string, AppConnectionState>();
    for (const c of list ?? []) {
      const kind =
        c.status === "ACTIVE"
          ? "active"
          : BROKEN.has(c.status)
            ? "broken"
            : null;
      if (!kind) continue;
      const prev = map.get(c.toolkit);
      if (prev?.kind === "active" && kind === "broken") continue; // a working connection wins
      const same = prev && prev.kind === kind ? prev.connections : [];
      map.set(c.toolkit, { kind, connections: [...same, c] });
    }
    return map;
  }, [list]);

  const connect = async (slug: string) => {
    setBusy(slug);
    try {
      window.location.href = await authorizeApp(slug);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  const disconnect = async (connection: Connection, appName: string) => {
    setBusy(connection.toolkit);
    try {
      await disconnectApp(connection.id);
      toast.success(`Disconnected ${appName}`);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return {
    ready: list !== null,
    error,
    byApp,
    connectedSlugs: [...byApp.keys()],
    stateOf: (slug: string): AppConnectionState =>
      byApp.get(slug) ?? { kind: "none" },
    busy,
    connect,
    disconnect,
    reload,
  };
}
