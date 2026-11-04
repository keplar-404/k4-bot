"use client";

import { useEffect, useState } from "react";
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
  web: "standard" | "advanced";
  defaults: DomainDefaults;
  recommended: { skills: string[]; apps: string[] };
}

export const FALLBACK_DEFAULTS: DomainDefaults = {
  subagents: false,
  maxSubagents: 5,
  maxParallelTools: 5,
};

let cached: Promise<DomainInfo[]> | null = null;

/** Per-role defaults from the server (modules/agent/domains), fetched once per page load. A failure falls back quietly. */
export function useDomains(): DomainInfo[] {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  useEffect(() => {
    cached ??= fetch(`${BASE}/api/v1/bots/domains`, { credentials: "include" })
      .then((r) => {
        if (r.ok) return r.json();
        cached = null; // a failed reply must not stick for the whole page load
        return { domains: [] };
      })
      .then((b) => (b as { domains?: DomainInfo[] }).domains ?? [])
      .catch(() => {
        cached = null;
        return [];
      });
    let live = true;
    void cached.then((d) => live && setDomains(d));
    return () => {
      live = false;
    };
  }, []);
  return domains;
}
