"use client";

import { toast } from "sonner";
import { create } from "zustand";
import {
  listWorkflows,
  type RunRange,
  type RunsBucket,
  type WorkflowListItem,
} from "./api";

/**
 * The user's workflows with their run stats, shared by the overview and anything else that lists them. `range`
 * (day / week / month / year) is the period every number on the overview is for: changing it reloads them all.
 */
type WorkflowListState = {
  items: WorkflowListItem[] | null;
  /** The chart's bars for `range`, oldest first. */
  series: RunsBucket[];
  range: RunRange;
  /** A reload for a new range is on its way (the old numbers stay, dimmed). */
  loading: boolean;
  error: string | null;
  /** The workflow (or "create") whose action is in flight. */
  busy: string | null;
  reload: () => Promise<void>;
  setRange: (range: RunRange) => void;
  /** Runs an action with `key` shown busy, then reloads the list. */
  run: (
    key: string,
    action: () => Promise<unknown>,
    done?: string,
  ) => Promise<void>;
};

let seq = 0;

export const useWorkflowListStore = create<WorkflowListState>()((set, get) => ({
  items: null,
  series: [],
  range: "day",
  loading: false,
  error: null,
  busy: null,
  reload: async () => {
    // Only the newest answer counts: switching ranges quickly never shows an older range's numbers.
    const mine = ++seq;
    const range = get().range;
    set({ loading: true });
    try {
      const r = await listWorkflows(range);
      if (mine === seq) set({ items: r.items, series: r.series, error: null });
    } catch (e) {
      if (mine === seq) set({ error: (e as Error).message });
    } finally {
      if (mine === seq) set({ loading: false });
    }
  },
  setRange: (range) => {
    if (range === get().range) return;
    set({ range });
    void get().reload();
  },
  run: async (key, action, done) => {
    set({ busy: key });
    try {
      await action();
      if (done) toast.success(done);
      await get().reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },
}));
