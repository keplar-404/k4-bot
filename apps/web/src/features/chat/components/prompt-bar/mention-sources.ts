"use client";

import { useEffect, useState } from "react";
import { fetchCatalog, fetchConnections } from "@/features/connect/api";
import { listFiles } from "@/features/files/api/library";
import { listWorkflows } from "@/features/workflows/api";
import { ATTACH, type Source } from "./data";

const PER_SECTION = 6;

/** What "@" can mention, loaded once when the menu first opens: files, the user's apps, workflows, recent files. */
async function loadSources(): Promise<Source[]> {
  const [connections, popular, workflows, files] = await Promise.all([
    fetchConnections().catch(() => []),
    fetchCatalog({ offset: 0, limit: 30 }).catch(() => ({
      items: [],
      total: 0,
    })),
    listWorkflows().catch(() => ({ items: [] })),
    listFiles().catch(() => ({ files: [], nextCursor: null })),
  ]);
  const activeSlugs = [
    ...new Set(
      connections.filter((c) => c.status === "ACTIVE").map((c) => c.toolkit),
    ),
  ];
  const connectedApps = activeSlugs.length
    ? (
        await fetchCatalog({ slugs: activeSlugs, offset: 0, limit: 50 }).catch(
          () => ({ items: [] }),
        )
      ).items
    : [];
  const connected = new Set(activeSlugs);
  return [
    ATTACH,
    ...connectedApps.map((a) => ({
      key: `app:${a.slug}`,
      name: a.name,
      desc: "Connected app",
      section: "Apps",
      logo: a.logo,
    })),
    ...popular.items
      .filter((a) => !connected.has(a.slug))
      .map((a) => ({
        key: `app:${a.slug}`,
        name: a.name,
        desc: a.noAuth ? "No login needed" : "Not connected",
        section: "Apps",
        logo: a.logo,
        connect: a.noAuth ? undefined : a.slug,
      })),
    ...workflows.items.slice(0, 30).map((w) => ({
      key: `workflow:${w.id}`,
      name: w.name,
      desc: w.status === "active" ? "Workflow · on" : "Workflow · off",
      section: "Workflows",
      glyph: "layers",
    })),
    ...files.files.slice(0, 20).map((f) => ({
      key: `file:${f.id}`,
      name: f.name,
      desc: "Stored file",
      section: "Files",
      glyph: "clip",
    })),
  ];
}

/** The "@" menu's entries, filtered by what was typed after "@" (a few per section, connected apps first). */
export function useMentionSources(open: boolean, query: string): Source[] {
  const [all, setAll] = useState<Source[] | null>(null);
  useEffect(() => {
    if (open && all === null) void loadSources().then(setAll);
  }, [open, all]);
  const q = query.toLowerCase();
  const matches = (all ?? [ATTACH]).filter(
    (s) => !q || `${s.name} ${s.desc}`.toLowerCase().includes(q),
  );
  const counts = new Map<string, number>();
  return matches.filter((s) => {
    const n = (counts.get(s.section) ?? 0) + 1;
    counts.set(s.section, n);
    return n <= PER_SECTION;
  });
}
