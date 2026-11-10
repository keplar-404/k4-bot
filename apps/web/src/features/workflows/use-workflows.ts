"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  createWorkflow,
  deleteWorkflow,
  pauseWorkflow,
  publishWorkflow,
  type WorkflowListItem,
} from "./api";
import { useWorkflowListStore } from "./list-store";

/** The user's workflows from the shared store, and the actions the overview offers. */
export function useWorkflows() {
  const router = useRouter();
  const { items, series, range, setRange, loading, error, busy, reload, run } =
    useWorkflowListStore(
      useShallow((s) => ({
        items: s.items,
        series: s.series,
        range: s.range,
        setRange: s.setRange,
        loading: s.loading,
        error: s.error,
        busy: s.busy,
        reload: s.reload,
        run: s.run,
      })),
    );
  useEffect(() => void reload(), [reload]);

  return {
    items,
    series,
    range,
    setRange,
    loading,
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
