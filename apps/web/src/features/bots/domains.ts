"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { RoleId } from "@/features/bots/roles";

const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

/** Hard ceilings: one definition, shared with the server (that file only has type imports, so nothing else is bundled). */
export {
  MAX_PARALLEL_TOOLS,
  MAX_SUBAGENTS,
} from "@backend/modules/agent/domains/types";

export interface DomainDefaults {
  subagents: boolean;
  maxSubagents: number;
  maxParallelTools: number;
}

/** What a role means for a new bot: its default capabilities and the skills/apps suggested for it. */
export interface DomainInfo {
  id: RoleId;
  defaults: DomainDefaults;
  recommended: { skills: string[]; apps: string[] };
}

export const FALLBACK_DEFAULTS: DomainDefaults = {
  subagents: false,
  maxSubagents: 5,
  maxParallelTools: 5,
};

/** Per-role defaults from the server (modules/agent/domains), shared and fetched once per page load. */
const useDomainsStore = create<{
  domains: DomainInfo[];
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
}>()((set, get) => ({
  domains: [],
  loaded: false,
  loading: false,
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    // A failure falls back quietly and is tried again on the next mount.
    const domains = await fetch(`${BASE}/api/v1/bots/domains`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => (b as { domains?: DomainInfo[] } | null)?.domains ?? null)
      .catch(() => null);
    set({ loading: false, ...(domains ? { domains, loaded: true } : {}) });
  },
}));

export function useDomains(): DomainInfo[] {
  const domains = useDomainsStore((s) => s.domains);
  const load = useDomainsStore((s) => s.load);
  useEffect(() => void load(), [load]);
  return domains;
}
