"use client";

import { CheckIcon, PlugIcon, PuzzleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type RoleId, roleLabel } from "@/lib/bot-roles";
import { openIntegrations, useIntegrations } from "@/lib/integrations";

function Chip({
  label,
  hint,
  selected,
  onToggle,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={hint}
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition hover:bg-muted ${
        selected
          ? "border-primary bg-primary/10 text-foreground"
          : "text-muted-foreground"
      }`}
    >
      {selected && <CheckIcon className="size-3" />}
      {label}
    </button>
  );
}

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

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
      <fieldset className="space-y-2">
        <legend className="flex w-full items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-1.5">
            <PuzzleIcon className="size-4" />
            Skills
          </span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => openIntegrations("skills")}
          >
            Browse skills
          </Button>
        </legend>
        {installedSkills.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No skills installed yet. Browse skills to install some
            {role !== "custom" ? ` for ${roleLabel(role)} bots` : ""}.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {installedSkills.map((s) => (
              <Chip
                key={s.id}
                label={s.title}
                hint={
                  s.role === role
                    ? `Made for ${roleLabel(role)} bots. ${s.description}`
                    : s.description
                }
                selected={skillIds.includes(s.id)}
                onToggle={() => onSkillsChange(toggle(skillIds, s.id))}
              />
            ))}
          </div>
        )}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="flex w-full items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-1.5">
            <PlugIcon className="size-4" />
            MCP servers
          </span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => openIntegrations("mcp")}
          >
            Connect apps
          </Button>
        </legend>
        {installedApps.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No apps connected yet. Connect Airtable or shadcn/ui to let this bot
            use them.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {installedApps.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                hint={a.summary}
                selected={mcpServerIds.includes(a.id)}
                onToggle={() => onMcpChange(toggle(mcpServerIds, a.id))}
              />
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
