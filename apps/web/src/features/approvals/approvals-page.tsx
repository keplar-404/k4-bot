"use client";

import { CheckIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { request } from "@/features/workflows/api";

type Approval = {
  runId: string;
  nodeId: string;
  question: string;
  since: string;
  workflowId: string;
  workflowName: string;
  trigger: string;
  botId: string | null;
};

const answer = (a: Approval, approved: boolean) =>
  request<{ ok: true }>(`/runs/${a.runId}/steps/${a.nodeId}/answer`, {
    method: "POST",
    body: JSON.stringify({ approved, note: "" }),
  });

/** Every workflow run waiting at an "Ask me first" block, in one place: approve or decline without opening the builder. */
export function ApprovalsPage() {
  const [items, setItems] = useState<Approval[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(
    () =>
      request<{ items: Approval[] }>("/approvals").then(
        (r) => setItems(r.items),
        (e: Error) => toast.error(e.message),
      ),
    [],
  );
  useEffect(() => {
    void load();
    // New approvals appear while the page is open (a scheduled or bot-started run reaches its block).
    const timer = setInterval(() => !document.hidden && void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const decide = async (a: Approval, approved: boolean) => {
    setBusy(a.runId + a.nodeId);
    try {
      await answer(a, approved);
      toast.success(
        approved
          ? "Approved: the run goes on."
          : "Declined: the steps after it are skipped.",
      );
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

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
