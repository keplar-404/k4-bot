"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WorkflowStatusBadge } from "../../components/status-badges";
import { useBuilder } from "../store";
import type { SaveState } from "../use-autosave";
import { IssuesMenu } from "./issues-menu";
import { MoreMenu } from "./more-menu";
import { NameInput } from "./name-input";
import { PowerButtons } from "./power-buttons";
import { SaveIndicator } from "./save-indicator";

/** Back, name, save state on the left; what is left to do, run controls (`children`) and on / off on the right. */
export function TopBar({
  save,
  children,
}: {
  save: { state: SaveState; message: string | null };
  children?: ReactNode;
}) {
  const w = useBuilder((s) => s.workflow);
  if (!w) return null;
  const active = w.status === "active";
  const _isWebhook = w.graph.nodes.some((n) => n.kind === "trigger.webhook");

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        render={<Link href="/dashboard/workflow" />}
        aria-label="Back to workflows"
      >
        <ArrowLeftIcon />
      </Button>
      <NameInput />
      <WorkflowStatusBadge status={w.status} />
      {active && w.hasUnpublishedChanges && (
        <span className="hidden text-amber-600 text-xs lg:inline dark:text-amber-400">
          Unpublished changes
        </span>
      )}
      <SaveIndicator state={save.state} message={save.message} />
      <div className="ml-auto flex items-center gap-2">
        <IssuesMenu />
        {children}
        <PowerButtons save={save} />
        <MoreMenu />
      </div>
    </header>
  );
}
