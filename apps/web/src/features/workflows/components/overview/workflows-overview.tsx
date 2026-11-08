"use client";

import { Loader2Icon, PlusIcon, WorkflowIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkflowListItem } from "../../api";
import { useWorkflows } from "../../use-workflows";
import { DeleteWorkflowDialog } from "./delete-workflow-dialog";
import { RunsChart } from "./runs-chart";
import { StatTiles } from "./stat-tiles";
import { WorkflowCard } from "./workflow-card";

/** All of the user's workflows: how they ran this week, each as a card, and the way to make a new one. */
export function WorkflowsOverview() {
  const wf = useWorkflows();
  const [deleting, setDeleting] = useState<WorkflowListItem | null>(null);
  const creating = wf.busy === "create";
  const create = (
    <Button onClick={() => void wf.create()} disabled={creating}>
      {creating ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
      Create workflow
    </Button>
  );

  return (
    <>
      <PageHeader title="Workflow" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-semibold text-2xl tracking-tight">Workflows</h1>
            <p className="max-w-2xl text-muted-foreground text-sm">
              Automate work across your connected apps: pick what starts it, add
              steps, branches and waits, and watch every run step by step.
            </p>
          </div>
          {create}
        </div>

        {wf.error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm"
          >
            {wf.error}
          </p>
        )}

        {wf.items === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : wf.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <WorkflowIcon className="size-6 text-muted-foreground" />
            </span>
            <h2 className="font-medium">Build your first workflow</h2>
            <p className="max-w-md text-muted-foreground text-sm">
              Start it by hand, on a schedule or from a webhook, then chain
              actions in Gmail, Slack, Notion and 1,700 more apps.
            </p>
            {create}
          </div>
        ) : (
          <>
            <StatTiles items={wf.items} />
            <RunsChart daily={wf.daily} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {wf.items.map((w) => (
                <WorkflowCard
                  key={w.id}
                  w={w}
                  busy={wf.busy === w.id}
                  onToggle={() => void wf.toggle(w)}
                  onDelete={() => setDeleting(w)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <DeleteWorkflowDialog
        w={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void wf.remove(deleting);
          setDeleting(null);
        }}
      />
    </>
  );
}
