"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/features/bots/roles";
import type { CatalogSkill, SkillRole } from "@/features/integrations/api";
import { InstallButton } from "./install-button";
import { publisher, RoleBadge } from "./role-badge";

const FILTERS = ROLES.filter((r) => r.id !== "custom");

/** The catalog, filterable by role. A card opens the skill's details; + installs it. */
export function SkillCatalog({
  catalog,
  onOpen,
}: {
  catalog: CatalogSkill[];
  onOpen: (skill: CatalogSkill) => void;
}) {
  const [filter, setFilter] = useState<SkillRole | "all">("all");
  const shown =
    filter === "all" ? catalog : catalog.filter((s) => s.role === filter);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Browse skills</h3>
        <div
          role="tablist"
          aria-label="Filter by role"
          className="flex flex-wrap gap-1"
        >
          {[{ id: "all" as const, label: "All" }, ...FILTERS].map((r) => (
            <Button
              key={r.id}
              role="tab"
              aria-selected={filter === r.id}
              size="xs"
              variant={filter === r.id ? "secondary" : "ghost"}
              onClick={() => setFilter(r.id as SkillRole | "all")}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((s) => (
          <li key={s.id}>
            {/* biome-ignore lint/a11y/useSemanticElements: the card holds its own install button, so it cannot be a <button> */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(s);
                }
              }}
              className="flex h-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  {filter === "all" && <RoleBadge role={s.role} />}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {s.summary}
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  {publisher(s.id)}
                </p>
              </div>
              <InstallButton skill={s} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
