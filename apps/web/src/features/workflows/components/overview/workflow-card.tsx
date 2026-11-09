"use client";

import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { AppLogo } from "@/features/connect/components/app-logo";
import type { WorkflowListItem } from "../../api";
import { appsOf, logoOf, triggerLabel } from "../../describe";
import { WorkflowStatusBadge } from "../status-badges";
import { WorkflowCardMenu } from "./workflow-card-menu";
import { WorkflowCardStats } from "./workflow-card-stats";

/**
 * One workflow: name, status and how it starts; the apps it uses; how it ran this week; and an on/off switch.
 * The whole card opens the builder; the switch and menu work without opening it.
 */
export function WorkflowCard({
  w,
  busy,
  onToggle,
  onDelete,
}: {
  w: WorkflowListItem;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const apps = appsOf(w.graph);
  const canTurnOn = w.status === "active" || w.issues.length === 0;
  return (
    <article className="group relative flex flex-col gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/workflows/${w.id}`}
            className="font-medium leading-tight outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {w.name}
          </Link>
          <p className="mt-1 text-muted-foreground text-xs">
            {triggerLabel(w.graph)}
          </p>
          {w.status === "paused" && w.pausedReason && (
            <p className="mt-1 text-amber-700 text-xs dark:text-amber-400">
              {w.pausedReason}
            </p>
          )}
        </div>
        <WorkflowStatusBadge status={w.status} />
      </div>

      <div className="flex min-h-7 items-center gap-1.5">
        {apps.length === 0 ? (
          <span className="text-muted-foreground text-xs">No apps yet</span>
        ) : (
          apps
            .slice(0, 5)
            .map((slug) => (
              <AppLogo key={slug} src={logoOf(slug)} name={slug} size="sm" />
            ))
        )}
        {apps.length > 5 && (
          <span className="text-muted-foreground text-xs">
            +{apps.length - 5}
          </span>
        )}
      </div>

      <WorkflowCardStats w={w} />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <Switch
            size="sm"
            checked={w.status === "active"}
            disabled={busy || !canTurnOn}
            onCheckedChange={onToggle}
            aria-label={`Turn ${w.name} ${w.status === "active" ? "off" : "on"}`}
          />
          <span className="text-muted-foreground">
            {w.status === "active"
              ? "On"
              : canTurnOn
                ? "Off"
                : "Finish setup to turn on"}
          </span>
        </div>
        <WorkflowCardMenu id={w.id} name={w.name} onDelete={onDelete} />
      </div>
    </article>
  );
}
