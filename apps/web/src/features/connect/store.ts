"use client";

import { toast } from "sonner";
import { create } from "zustand";
import {
  authorizeApp,
  type Category,
  type Connection,
  disconnectApp,
  fetchCategories,
  fetchConnections,
} from "./api";

/**
 * The user's app connections (and the catalog's categories), shared by the Connect page, the bot form, the chat's
 * "@" menu and the workflow builder: a connect or disconnect anywhere updates all of them.
 */
type ConnectState = {
  /** null until the first load. */
  list: Connection[] | null;
  error: string | null;
  /** The app whose connect/disconnect is in flight. */
  busy: string | null;
  categories: Category[] | null;
  reload: () => Promise<void>;
  loadCategories: () => Promise<void>;
  connect: (slug: string) => Promise<void>;
  disconnect: (connection: Connection, appName: string) => Promise<void>;
};

let inflight: Promise<void> | null = null;

export const useConnectStore = create<ConnectState>()((set, get) => ({
  list: null,
  error: null,
  busy: null,
  categories: null,

  reload: () => {
    inflight ??= fetchConnections()
      .then((list) => set({ list, error: null }))
      .catch((e: Error) => set({ error: e.message }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },

  loadCategories: async () => {
    if (get().categories) return;
    // An empty list when they cannot load: the filter just offers "All".
    const categories = await fetchCategories().catch(() => []);
    set({ categories });
  },

  connect: async (slug) => {
    set({ busy: slug });
    try {
      window.location.href = await authorizeApp(slug);
    } catch (e) {
      toast.error((e as Error).message);
      set({ busy: null });
    }
  },

  disconnect: async (connection, appName) => {
    set({ busy: connection.toolkit });
    try {
      await disconnectApp(connection.id);
      // Gone at once everywhere; the reload confirms with the server.
      set((s) => ({
        list: (s.list ?? []).filter((c) => c.id !== connection.id),
      }));
      toast.success(`Disconnected ${appName}`);
      await get().reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      set({ busy: null });
    }
  },
}));
