"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { SandboxRow } from "@/features/sandboxes/api";
import { DeleteSandboxDialog } from "@/features/sandboxes/delete-sandbox-dialog";
import { SandboxesTable } from "@/features/sandboxes/sandboxes-table";
import { useSandboxes } from "@/features/sandboxes/use-sandboxes";

/** Every code sandbox of the user (one per coding bot), with the limits, and Start / Pause / Delete. */
export default function SandboxesPage() {
  const { data, error, busy, act } = useSandboxes();
  const [deleting, setDeleting] = useState<SandboxRow | null>(null);

  return (
    <div className="flex h-svh min-h-0 flex-col">
      <PageHeader title="Sandboxes" />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
        <p className="max-w-prose text-sm text-muted-foreground">
          Each coding bot has at most one sandbox: a Linux machine where it
          writes and runs code. A sandbox pauses by itself when nobody is using
          it, and its files are kept until you delete it.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!data && !error && <Skeleton className="h-24 w-full" />}
        {data && (
          <>
            <p className="text-sm">
              {data.sandboxes.length} of {data.limits.maxPerUser} sandboxes ·{" "}
              {Math.round(data.limits.secondsToday / 60)} of{" "}
              {data.limits.maxMinutesPerDay} min used today
            </p>
            {data.sandboxes.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No sandboxes yet. A coding bot creates one when it starts
                writing code.
              </p>
            ) : (
              <SandboxesTable
                rows={data.sandboxes}
                busy={busy}
                onAction={(a, id) => void act(a, id)}
                onDelete={setDeleting}
              />
            )}
          </>
        )}
      </div>
      <DeleteSandboxDialog
        row={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void act("delete", deleting.botId);
          setDeleting(null);
        }}
      />
    </div>
  );
}
