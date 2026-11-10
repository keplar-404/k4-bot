"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { deleteFile, type LibraryFile, listFiles } from "./api/library";

/**
 * The user's stored files, shared by the Files page and every file picker: a delete or a new page loaded in one
 * place shows in all of them.
 */
type FilesState = {
  files: LibraryFile[];
  cursor: string | null;
  /** The first page is loading. */
  loading: boolean;
  /** A next page is loading. */
  more: boolean;
  error: string | null;
  /** The file the user is asked to confirm deleting, and whether that delete is running. */
  deleting: LibraryFile | null;
  busy: boolean;
  /** `null` starts over; a cursor adds the next page. */
  load: (after: string | null) => Promise<void>;
  setDeleting: (file: LibraryFile | null) => void;
  confirmDelete: () => Promise<void>;
  /** A file added elsewhere (an upload, a generated image) appears at the top at once. */
  add: (file: LibraryFile) => void;
};

export const useFilesStore = create<FilesState>()((set, get) => ({
  files: [],
  cursor: null,
  loading: true,
  more: false,
  error: null,
  deleting: null,
  busy: false,

  load: async (after) => {
    set(after ? { more: true, error: null } : { loading: true, error: null });
    try {
      const page = await listFiles(after);
      set((s) => ({
        files: after ? [...s.files, ...page.files] : page.files,
        cursor: page.nextCursor,
      }));
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false, more: false });
    }
  },

  setDeleting: (file) => set({ deleting: file }),

  confirmDelete: async () => {
    const file = get().deleting;
    if (!file) return;
    set({ busy: true });
    try {
      await deleteFile(file.id);
      set((s) => ({
        files: s.files.filter((f) => f.id !== file.id),
        deleting: null,
      }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      set({ busy: false });
    }
  },

  add: (file) =>
    set((s) => ({ files: [file, ...s.files.filter((f) => f.id !== file.id)] })),
}));
