"use client";

import { PlugIcon, PuzzleIcon } from "lucide-react";
import { type RoleId, roleLabel } from "@/features/bots/roles";
import { openIntegrations, useIntegrations } from "@/features/integrations/api";
import { PickerSection } from "./picker-section";

/**
 * Which installed skills and connected apps a bot uses, inside the bot form. Skills and apps made for the bot's
 * role come first. Nothing is installed here: the Skills & MCP dialog does that.
 */
export function BotIntegrationsPicker({
  role,
  skillIds,
  mcpServerIds,
  onSkillsChange,
  onMcpChange,
}: {
  role: RoleId;
  skillIds: string[];
  mcpServerIds: string[];
  onSkillsChange: (ids: string[]) => void;
  onMcpChange: (ids: string[]) => void;
}) {
  const { skills, mcp } = useIntegrations();
  const installedSkills = [...(skills?.installed ?? [])].sort(
    (a, b) => Number(b.role === role) - Number(a.role === role),
  );
  const installedApps = [...(mcp?.installed ?? [])].sort((a, b) => {
    const fits = (serverId: string) =>
      mcp?.catalog.find((c) => c.id === serverId)?.roles.includes(role) ??
      false;
    return Number(fits(b.serverId)) - Number(fits(a.serverId));
  });

  return (
    <div className="flex w-full flex-col gap-4">
      <PickerSection
        icon={<PuzzleIcon className="size-4" />}
        title="Skills"
        browseLabel="Browse skills"
        onBrowse={() => openIntegrations("skills")}
        empty={`No skills installed yet. Browse skills to install some${role !== "custom" ? ` for ${roleLabel(role)} bots` : ""}.`}
        items={installedSkills.map((s) => ({
          id: s.id,
          label: s.title,
          hint:
            s.role === role
              ? `Made for ${roleLabel(role)} bots. ${s.description}`
              : s.description,
        }))}
        selected={skillIds}
        onChange={onSkillsChange}
      />
      <PickerSection
        icon={<PlugIcon className="size-4" />}
        title="MCP servers"
        browseLabel="Connect apps"
        onBrowse={() => openIntegrations("mcp")}
        empty="No apps connected yet. Connect Airtable or shadcn/ui to let this bot use them."
        items={installedApps.map((a) => ({
          id: a.id,
          label: a.name,
          hint: a.summary,
        }))}
        selected={mcpServerIds}
        onChange={onMcpChange}
      />
    </div>
  );
}
