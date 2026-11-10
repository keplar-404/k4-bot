"use client";

import { useEffect, useMemo } from "react";
import type { Connection } from "./api";
import { useConnectStore } from "./store";

/** Statuses that mean the connection exists but stopped working: the app shows "Reconnect". */
const BROKEN = new Set(["EXPIRED", "FAILED", "INACTIVE", "REVOKED"]);

export type AppConnectionState =
  | { kind: "none" }
  | { kind: "active"; connections: Connection[] }
  | { kind: "broken"; connections: Connection[] };

/** The user's connections from the shared store, grouped per app, with connect / disconnect. Unfinished link attempts are ignored. */
export function useConnections() {
  const list = useConnectStore((s) => s.list);
  const error = useConnectStore((s) => s.error);
  const busy = useConnectStore((s) => s.busy);
  const reload = useConnectStore((s) => s.reload);
  const connect = useConnectStore((s) => s.connect);
  const disconnect = useConnectStore((s) => s.disconnect);

  useEffect(() => {
    if (useConnectStore.getState().list === null) void reload();
  }, [reload]);

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
