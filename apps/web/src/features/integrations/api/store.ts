"use client";

import { useEffect, useSyncExternalStore } from "react";
import { request } from "./http";
import type {
  CatalogMcp,
  CatalogSkill,
  InstalledMcp,
  InstalledSkill,
} from "./types";

type State = {
  skills: { catalog: CatalogSkill[]; installed: InstalledSkill[] } | null;
  mcp: { catalog: CatalogMcp[]; installed: InstalledMcp[] } | null;
  error: string | null;
};

/*
 * One store for the whole page: the Skills & MCP dialog and the bot form read the same lists, so installing in
 * one shows up in the other without a refetch.
 */
let state: State = { skills: null, mcp: null, error: null };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let loading: Promise<void> | null = null;

export function refreshIntegrations(): Promise<void> {
  loading ??= Promise.all([
    request<NonNullable<State["skills"]>>("/skills"),
    request<NonNullable<State["mcp"]>>("/mcp"),
  ])
    .then(([skills, mcp]) => set({ skills, mcp, error: null }))
    .catch((e: Error) => set({ error: e.message }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** The user's skills and connected apps, loaded once and shared. */
export function useIntegrations() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  useEffect(() => {
    if (!state.skills && !loading) void refreshIntegrations();
  }, []);
  return snapshot;
}
