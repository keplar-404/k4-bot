"use client";

import { RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { request } from "../../../api";

type Call = {
  at: string;
  status: number;
  reason: string;
  ipHash: string;
  runId: string | null;
};

/** The latest calls to this webhook: accepted or refused and why (a wrong token, a bad signature, a blocked IP…). */
export function WebhookRequests({ workflowId }: { workflowId: string }) {
  const [{ calls }, , store] = useLocalStore(() => ({
    calls: null as Call[] | null,
  }));
  const setCalls = fieldSetter(store, "calls");
  const load = useCallback(
    () =>
      request<{ items: Call[] }>(`/${workflowId}/hook-requests`).then(
        (r) => setCalls(r.items),
        () => setCalls([]),
      ),
    [workflowId, setCalls],
  );
  useEffect(() => void load(), [load]);
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        size="xs"
        variant="ghost"
        className="self-end"
        onClick={() => void load()}
      >
        <RefreshCwIcon /> Refresh
      </Button>
      {calls?.length === 0 && (
        <p className="text-muted-foreground text-xs">No calls yet.</p>
      )}
      {calls?.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a read-only log, newest first
        <div key={i} className="flex items-baseline gap-2 text-xs">
          <span
            className={`w-9 shrink-0 font-mono ${c.status < 300 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
          >
            {c.status}
          </span>
          <span className="min-w-0 flex-1 truncate">{c.reason}</span>
          <span
            className="shrink-0 text-muted-foreground"
            title={`Sender ${c.ipHash}`}
          >
            {new Date(c.at).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
