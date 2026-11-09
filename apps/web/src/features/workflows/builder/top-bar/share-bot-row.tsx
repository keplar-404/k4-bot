"use client";

import { Switch } from "@/components/ui/switch";
import { BloubAvatar } from "@/features/avatar/components/bloub-avatar";
import type { Bot } from "@/features/bots/api";
import { roleLabel } from "@/features/bots/roles";

/** One bot in the share dialog: avatar, name, role, and whether it may use this workflow. */
export function ShareBotRow({
  bot,
  shared,
  disabled,
  onToggle,
  toggleLabel = "Share with",
}: {
  /** Start of the switch's accessible name ("Share with", "Add to group"). */
  toggleLabel?: string;
  bot: Bot;
  shared: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const id = `share-${bot.id}`;
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <BloubAvatar
        size={32}
        shape={bot.shape}
        color={bot.color}
        expression={bot.expression}
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block truncate font-medium text-sm">{bot.name}</span>
        <span className="block truncate text-muted-foreground text-xs">
          {roleLabel(bot.role, bot.roleTitle)}
        </span>
      </label>
      <Switch
        id={id}
        checked={shared}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={`${toggleLabel} ${bot.name}`}
      />
    </li>
  );
}
