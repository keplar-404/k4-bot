"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createWorkflow,
  type DailyRuns,
  deleteWorkflow,
  listWorkflows,
  pauseWorkflow,
  publishWorkflow,
  type WorkflowListItem,
} from "./api";

/** The user's workflows with their run stats, and the actions the overview offers. */
export function useWorkflows() {
  const router = useRouter();
  const [items, setItems] = useState<WorkflowListItem[] | null>(null);
  const [daily, setDaily] = useState<DailyRuns[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      listWorkflows()
        .then((r) => {
          setItems(r.items);
          setDaily(r.daily);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => void reload(), [reload]);

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    done?: string,
  ) => {
    setBusy(key);
    try {
      await action();
      if (done) toast.success(done);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return {
    items,
    daily,
    error,
    busy,
    reload,
    create: () =>
      run("create", async () => {
        const w = await createWorkflow();
        router.push(`/workflows/${w.id}`);
      }),
    toggle: (w: WorkflowListItem) =>
      w.status === "active"
        ? run(w.id, () => pauseWorkflow(w.id), `${w.name} is off`)
        : run(w.id, () => publishWorkflow(w.id), `${w.name} is on`),
    remove: (w: WorkflowListItem) =>
      run(w.id, () => deleteWorkflow(w.id), `Deleted ${w.name}`),
  };
}
