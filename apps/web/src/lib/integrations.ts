"use client";

import { useEffect, useSyncExternalStore } from "react";
import { redirectToSignIn } from "@/lib/auth-redirect";
import type { RoleId } from "@/lib/bot-roles";

const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

export type SkillRole = Exclude<RoleId, "custom">;

export interface CatalogSkill {
  id: string;
  name: string;
  role: SkillRole;
  summary: string;
  /** The user's install of it, if any. */
  installedId: string | null;
}

export interface InstalledSkill {
  id: string;
  skillId: string;
  name: string;
  title: string;
  description: string;
  role: SkillRole | null;
  installedAt: string;
}

export interface SkillDetails {
  id: string;
  name: string;
  role: SkillRole;
  summary: string;
  description: string;
  source: string;
  url: string;
  skillMd: string;
  files: Array<{ path: string; size: number }>;
}

export interface McpField {
  key: string;
  label: string;
  placeholder?: string;
  help: string;
  helpUrl?: string;
}

export interface CatalogMcp {
  id: string;
  name: string;
  publisher: string;
  roles: string[];
  summary: string;
  description: string;
  capabilities: string[];
  website: string;
  docsUrl: string;
  kind: "remote" | "builtin";
  fields: McpField[];
  connectedId: string | null;
}

export interface InstalledMcp {
  id: string;
  serverId: string;
  name: string;
  summary: string;
  kind: "remote" | "builtin";
  /** Last characters of the saved token (the token itself never comes back). */
  secretHint: string | null;
  needsSecrets: boolean;
  updatedAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/integrations${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Connection lost. Try again.");
  }
  if (res.status === 401) redirectToSignIn();
  const body = (await res.json().catch(() => null)) as
    | (T & { message?: string })
    | null;
  if (!res.ok)
    throw new Error(body?.message ?? "Something went wrong. Try again.");
  return body as T;
}

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

export function getSkillDetails(skillId: string) {
  return request<{ skill: SkillDetails }>(
    `/skills/details?skillId=${encodeURIComponent(skillId)}`,
  ).then((r) => r.skill);
}

export async function installSkill(skillId: string) {
  await request("/skills", {
    method: "POST",
    body: JSON.stringify({ skillId }),
  });
  await refreshIntegrations();
}

export async function uninstallSkill(id: string) {
  await request(`/skills/${id}`, { method: "DELETE" });
  await refreshIntegrations();
}

/** The token is sent once over HTTPS, checked against the app, then stored encrypted. It never comes back. */
export async function connectMcp(
  serverId: string,
  secrets?: Record<string, string>,
) {
  const result = await request<{ id: string; tools: string[] }>("/mcp", {
    method: "POST",
    body: JSON.stringify({ serverId, secrets }),
  });
  await refreshIntegrations();
  return result;
}

export async function replaceMcpSecrets(
  id: string,
  secrets: Record<string, string>,
) {
  await request(`/mcp/${id}/secrets`, {
    method: "PUT",
    body: JSON.stringify({ secrets }),
  });
  await refreshIntegrations();
}

export async function disconnectMcp(id: string) {
  await request(`/mcp/${id}`, { method: "DELETE" });
  await refreshIntegrations();
}

/** Opening the dialog from anywhere (the sidebar's Skills and MCP items). */
export type IntegrationsTab = "skills" | "mcp";
type DialogState = { open: boolean; tab: IntegrationsTab };
let dialog: DialogState = { open: false, tab: "skills" };
const dialogListeners = new Set<() => void>();
const setDialog = (next: DialogState) => {
  dialog = next;
  for (const l of dialogListeners) l();
};

export const openIntegrations = (tab: IntegrationsTab) =>
  setDialog({ open: true, tab });

export function useIntegrationsDialog() {
  const value = useSyncExternalStore(
    (l) => {
      dialogListeners.add(l);
      return () => dialogListeners.delete(l);
    },
    () => dialog,
    () => dialog,
  );
  return {
    ...value,
    setOpen: (open: boolean) => setDialog({ ...dialog, open }),
    setTab: (tab: IntegrationsTab) => setDialog({ ...dialog, tab }),
  };
}
