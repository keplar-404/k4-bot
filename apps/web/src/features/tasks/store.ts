"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { listTasks, type Task } from "./api";

/** The user's scheduled tasks, shared by the Tasks page and its dialog; every action updates it. */
type TasksState = {
  tasks: Task[] | null;
  /** The task being edited, "new" while creating one, null while the dialog is closed. */
  editing: Task | "new" | null;
  /** The task whose action is in flight. */
  busy: string | null;
  load: () => Promise<void>;
  setEditing: (editing: Task | "new" | null) => void;
  /** Runs an action on a task, then reloads the list. */
  act: (id: string, fn: () => Promise<unknown>, done: string) => Promise<void>;
};

export const useTasksStore = create<TasksState>()((set, get) => ({
  tasks: null,
  editing: null,
  busy: null,
  load: () =>
    listTasks().then(
      (tasks) => set({ tasks }),
      (e: Error) => {
        toast.error(e.message);
      },
    ),
  setEditing: (editing) => set({ editing }),
  act: async (id, fn, done) => {
    set({ busy: id });
    try {
      await fn();
      toast.success(done);
      await get().load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },
}));
