"use client";

import { create } from "zustand";
import { type Group, listGroups } from "./api";

/** The user's groups, shared by the sidebar, the group chat and the dialogs. Every change is written here. */
type GroupsState = {
  /** null until the first load. */
  groups: Group[] | null;
  load: () => Promise<void>;
  upsert: (group: Group) => void;
  remove: (id: string) => void;
  /** The sidebar section's UI: the create/edit dialog and the delete confirmation. */
  editing: Group | null;
  dialogOpen: boolean;
  deleting: Group | null;
  openCreate: () => void;
  openEdit: (group: Group) => void;
  setDialogOpen: (open: boolean) => void;
  setDeleting: (group: Group | null) => void;
};

let inflight: Promise<void> | null = null;

export const useGroupsStore = create<GroupsState>()((set) => ({
  groups: null,
  load: () => {
    inflight ??= listGroups()
      .then((groups) => set({ groups }))
      .catch(() => set((s) => ({ groups: s.groups ?? [] })))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  upsert: (group) =>
    set((s) => {
      const list = s.groups ?? [];
      const exists = list.some((g) => g.id === group.id);
      const next = exists
        ? list.map((g) => (g.id === group.id ? group : g))
        : [...list, group];
      return { groups: next.sort((a, b) => a.name.localeCompare(b.name)) };
    }),
  remove: (id) =>
    set((s) => ({ groups: (s.groups ?? []).filter((g) => g.id !== id) })),
  editing: null,
  dialogOpen: false,
  deleting: null,
  openCreate: () => set({ editing: null, dialogOpen: true }),
  openEdit: (group) => set({ editing: group, dialogOpen: true }),
  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
  setDeleting: (deleting) => set({ deleting }),
}));
