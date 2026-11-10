"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { BASE } from "@/features/files/api/library";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import {
  pauseWorkflow,
  publishWorkflow,
  request,
  type Workflow,
  type WorkflowApiError,
} from "../api";
import { useBuilder } from "./store";

/** The public URL another service calls to start a webhook workflow (shown once; only its hash is stored). */
export const webhookUrl = (workflowId: string, token: string) =>
  `${BASE}/api/v1/hooks/${workflowId}/${token}`;

/** One shared store: the URL is revealed by whichever button made it (Turn on or New webhook URL) and shown by the dialog. */
const useRevealed = create<{
  url: string | null;
  set: (url: string | null) => void;
}>((set) => ({ url: null, set: (url) => set({ url }) }));

/** Turn on (publish the current draft), turn off, and make a new webhook URL. */
export function usePublish() {
  const setWorkflow = useBuilder((s) => s.setWorkflow);
  const [{ busy }, , store] = useLocalStore(() => ({
    busy: false,
  }));
  const setBusy = fieldSetter(store, "busy");
  const revealed = useRevealed((s) => s.url);
  const setRevealed = useRevealed((s) => s.set);

  const act = async (
    fn: () => Promise<Workflow & { webhookToken?: string | null }>,
    done: string,
  ) => {
    const w = useBuilder.getState().workflow;
    if (!w) return;
    setBusy(true);
    try {
      const next = await fn();
      setWorkflow(next);
      if (next.webhookToken)
        setRevealed(webhookUrl(next.id, next.webhookToken));
      toast.success(done);
    } catch (e) {
      toast.error((e as WorkflowApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const id = () => useBuilder.getState().workflow?.id ?? "";
  return {
    busy,
    revealed,
    closeRevealed: () => setRevealed(null),
    publish: () =>
      act(
        () => publishWorkflow(id()),
        "Workflow is on. New changes go live when you publish again.",
      ),
    pause: () => act(() => pauseWorkflow(id()), "Workflow is off."),
    newWebhookUrl: async () => {
      setBusy(true);
      try {
        const { webhookToken } = await request<{ webhookToken: string }>(
          `/${id()}/webhook-token`,
          { method: "POST" },
        );
        setRevealed(webhookUrl(id(), webhookToken));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
  };
}
