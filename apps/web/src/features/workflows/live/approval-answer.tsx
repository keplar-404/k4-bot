"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { type RunDetail, request } from "../api";
import { refreshDetail } from "./live-events";

type Step = RunDetail["steps"][number];

const answerApproval = (runId: string, nodeId: string, approved: boolean) =>
  request<{ ok: true }>(`/runs/${runId}/steps/${nodeId}/answer`, {
    method: "POST",
    body: JSON.stringify({ approved, note: "" }),
  });

/** The step an "Ask me first" block is waiting on in this run, if any. */
export const waitingApproval = (run: RunDetail | null) =>
  run?.steps.find(
    (s) => s.nodeKind === "logic.approval" && s.status === "waiting",
  ) ?? null;

const questionOf = (step: Step) =>
  (step.output as { message?: string } | null)?.message || "Continue this run?";

/** Approve or decline a waiting "Ask me first" block. `compact` is the run banner's one-line form. */
export function ApprovalAnswer({
  runId,
  step,
  compact,
}: {
  runId: string;
  step: Step;
  compact?: boolean;
}) {
  const [{ busy }, , store] = useLocalStore(() => ({
    busy: false,
  }));
  const setBusy = fieldSetter(store, "busy");
  const answer = async (approved: boolean) => {
    setBusy(true);
    try {
      await answerApproval(runId, step.nodeId, approved);
      toast.success(
        approved
          ? "Approved: the run goes on."
          : "Declined: the steps after it are skipped.",
      );
      await refreshDetail(runId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const buttons = (
    <div className="flex gap-1.5">
      <Button size="xs" disabled={busy} onClick={() => void answer(true)}>
        <CheckIcon />
        Approve
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={busy}
        onClick={() => void answer(false)}
      >
        <XIcon />
        Decline
      </Button>
    </div>
  );
  if (compact) return buttons;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="whitespace-pre-wrap text-sm">{questionOf(step)}</p>
      {buttons}
    </div>
  );
}
