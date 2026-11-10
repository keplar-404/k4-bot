"use client";

import { CheckIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useApprovalsStore } from "./store";

/** Every workflow run waiting at an "Ask me first" block, in one place: approve or decline without opening the builder. */
export function ApprovalsPage() {
  const items = useApprovalsStore((s) => s.items);
  const busy = useApprovalsStore((s) => s.busy);
  const load = useApprovalsStore((s) => s.load);
  const decide = useApprovalsStore((s) => s.decide);
  useEffect(() => {
    void load();
    // New approvals appear while the page is open (a scheduled or bot-started run reaches its block).
    const timer = setInterval(() => !document.hidden && void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Approvals" />
      <p className="max-w-2xl text-muted-foreground text-sm">
        Workflow runs that reached an “Ask me first” block wait here for your
        answer. A waiting run costs nothing.
      </p>
      {items === null ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          <ShieldCheckIcon className="size-6" />
          Nothing is waiting for you.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li
              key={a.runId + a.nodeId}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/workflows/${a.workflowId}`}
                  className="font-medium hover:underline"
                >
                  {a.workflowName}
                </Link>
                <p className="text-muted-foreground text-xs">
                  Waiting since {new Date(a.since).toLocaleString()} · started
                  by {a.trigger === "bot" ? "a bot" : a.trigger}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {a.question || "Continue this run?"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void decide(a, true)}
                >
                  <CheckIcon /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void decide(a, false)}
                >
                  <XIcon /> Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
