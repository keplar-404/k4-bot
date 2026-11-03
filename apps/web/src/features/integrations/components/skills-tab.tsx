"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CatalogSkill,
  useIntegrations,
} from "@/features/integrations/api";
import { InstalledSkills } from "./skills/installed-skills";
import { SkillCatalog } from "./skills/skill-catalog";
import { SkillDetailsView } from "./skills/skill-details";

/**
 * Skills: curated per bot role. A card opens the skill's full details; + installs it for the user, and the bot
 * form then offers it.
 */
export function SkillsTab() {
  const { skills, error } = useIntegrations();
  const [selected, setSelected] = useState<CatalogSkill | null>(null);

  // Keep the open details in sync with installs (the + on the details page updates the shared list).
  const current = selected
    ? (skills?.catalog.find((s) => s.id === selected.id) ?? selected)
    : null;
  if (current)
    return (
      <SkillDetailsView skill={current} onBack={() => setSelected(null)} />
    );

  if (error && !skills)
    return <p className="text-sm text-destructive">{error}</p>;
  if (!skills)
    return (
      <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <InstalledSkills installed={skills.installed} />
      <SkillCatalog catalog={skills.catalog} onOpen={setSelected} />
    </div>
  );
}
