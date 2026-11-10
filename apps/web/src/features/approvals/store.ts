"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { request } from "@/features/workflows/api";

export type Approval = {
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

/** Every workflow run waiting at an "Ask me first" block. An answer removes it here at once. */
type ApprovalsState = {
  items: Approval[] | null;
  /** runId + nodeId of the answer being sent. */
  busy: string | null;
  load: () => Promise<void>;
  decide: (a: Approval, approved: boolean) => Promise<void>;
};

export const useApprovalsStore = create<ApprovalsState>()((set, get) => ({
  items: null,
  busy: null,
  load: () =>
    request<{ items: Approval[] }>("/approvals").then(
      (r) => set({ items: r.items }),
      (e: Error) => {
        toast.error(e.message);
      },
    ),
  decide: async (a, approved) => {
    set({ busy: a.runId + a.nodeId });
    try {
      await answer(a, approved);
      set((s) => ({
        items: (s.items ?? []).filter(
          (i) => !(i.runId === a.runId && i.nodeId === a.nodeId),
        ),
      }));
      toast.success(
        approved
          ? "Approved: the run goes on."
          : "Declined: the steps after it are skipped.",
      );
      await get().load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },
}));
