"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { useAccountsStore } from "@/features/computer/accounts-store";
import { useGroupsStore } from "@/features/groups/store";
import type { Bot } from "./api";
import { useBotsStore } from "./store";

/**
 * The bots section's UI state: the create/edit dialog and the delete confirmation. One store, so the sidebar and
 * the VM page share one delete dialog, and both lists update when a bot goes.
 */
type BotsUiState = {
  dialogOpen: boolean;
  editingBot: Bot | null;
  confirming: Bot | null;
  deleting: boolean;
  openCreate: () => void;
  openEdit: (bot: Bot) => void;
  setDialogOpen: (open: boolean) => void;
  askDelete: (id: string) => void;
  cancelDelete: () => void;
  /** Deletes the bot being confirmed. `onDeleted` runs after (e.g. leave its page). */
  confirmDelete: (onDeleted?: (bot: Bot) => void) => Promise<void>;
};

const cleanupMessage = {
  removed: "Its Linux account and files were removed from the computer.",
  pending:
    "The computer is asleep: its Linux account and files are removed the next time it starts.",
  failed:
    "Its Linux account could not be removed yet; it is retried the next time the computer starts.",
} as const;

export const useBotsUiStore = create<BotsUiState>()((set, get) => ({
  dialogOpen: false,
  editingBot: null,
  confirming: null,
  deleting: false,

  openCreate: () => set({ dialogOpen: true, editingBot: null }),
  openEdit: (bot) => set({ dialogOpen: true, editingBot: bot }),
  setDialogOpen: (open) =>
    set(open ? { dialogOpen: true } : { dialogOpen: false, editingBot: null }),

  askDelete: (id) =>
    set({
      confirming: useBotsStore.getState().bots.find((b) => b.id === id) ?? null,
    }),
  cancelDelete: () => set({ confirming: null }),

  confirmDelete: async (onDeleted) => {
    const bot = get().confirming;
    if (!bot || get().deleting) return;
    set({ deleting: true });
    try {
      const computer = await useBotsStore.getState().deleteBot(bot.id);
      const notify = computer === "failed" ? toast.warning : toast.success;
      notify(`${bot.name} was deleted.`, {
        description: cleanupMessage[computer],
      });
      set({ confirming: null });
      onDeleted?.(bot);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete bot.");
    } finally {
      set({ deleting: false });
      // The computer's accounts (VM page) reflect the deletion, checked on the machine.
      void useAccountsStore.getState().load();
      // Groups lose the deleted bot (and a group left with one bot may change).
      void useGroupsStore.getState().load();
    }
  },
}));
