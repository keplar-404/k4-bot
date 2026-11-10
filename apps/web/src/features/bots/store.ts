"use client";

import { create } from "zustand";
import {
  type Bot,
  BotApiError,
  type ComputerCleanup,
  type CreateBotInput,
  createAdminBot as createAdminBotApi,
  createBot as createBotApi,
  deleteBot as deleteBotApi,
  fetchBots,
  updateBot as updateBotApi,
} from "./api";

/**
 * The user's bots, shared by every component that shows them (sidebar, VM page, pickers…). Every change goes
 * through this store, so all of them update together; the server list is reloaded after each change.
 */
type BotsState = {
  bots: Bot[];
  /** The first load finished (successfully or not). */
  loaded: boolean;
  error: string | null;
  unauthorized: boolean;
  load: () => Promise<void>;
  createBot: (input: CreateBotInput) => Promise<Bot>;
  updateBot: (id: string, input: CreateBotInput) => Promise<Bot>;
  deleteBot: (id: string) => Promise<ComputerCleanup>;
  addAdminBot: () => Promise<Bot>;
  /** Signed out (or no session): nothing to load. */
  reset: () => void;
};

let inflight: Promise<void> | null = null;

export const useBotsStore = create<BotsState>()((set, get) => {
  /** Runs a change on the server, applies it here at once, then reloads the list in the background. */
  const mutate = async <T>(
    run: () => Promise<T>,
    apply: (result: T) => void,
  ) => {
    try {
      const result = await run();
      apply(result);
      void get().load();
      return result;
    } catch (e) {
      if (e instanceof BotApiError && e.status === 401)
        set({ unauthorized: true });
      throw e;
    }
  };

  return {
    bots: [],
    loaded: false,
    error: null,
    unauthorized: false,

    load: () => {
      // Many components mount at once: one request serves them all.
      inflight ??= fetchBots()
        .then((result) => {
          if (result.ok)
            set({ bots: result.bots, error: null, unauthorized: false });
          else if (result.status === 401) set({ unauthorized: true });
          else if (result.status !== 0)
            set({ error: "Failed to load bots. Please try again." });
          set({ loaded: true });
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },

    createBot: (input) =>
      mutate(
        () => createBotApi(input),
        (created) => set((s) => ({ bots: [created, ...s.bots] })),
      ),

    updateBot: (id, input) =>
      mutate(
        () => updateBotApi(id, input),
        (updated) =>
          set((s) => ({
            bots: s.bots.map((b) => (b.id === id ? updated : b)),
          })),
      ),

    deleteBot: (id) =>
      mutate(
        () => deleteBotApi(id),
        () => set((s) => ({ bots: s.bots.filter((b) => b.id !== id) })),
      ),

    addAdminBot: () =>
      mutate(createAdminBotApi, (admin) =>
        set((s) => ({
          bots: [admin, ...s.bots.filter((b) => b.id !== admin.id)],
        })),
      ),

    reset: () => set({ bots: [], loaded: true, error: null }),
  };
});
