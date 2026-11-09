"use client";

import { useBots } from "@/features/bots/hooks/use-bots";
import { appName } from "../block-label";

/** Which apps "Let it read the bot's connected apps" covers: the apps set up on that bot. */
export function AiAppsNote({ botId }: { botId: string | undefined }) {
  const { bots } = useBots();
  const apps = bots.find((b) => b.id === botId)?.composioApps ?? [];
  if (!botId) return null;
  return (
    <span className="block text-muted-foreground">
      {apps.length
        ? `It can read: ${apps.map((a) => appName(a.toolkit)).join(", ")}.`
        : "This bot has no apps yet: add them in the bot's settings."}
    </span>
  );
}
