"use client";

import { create } from "zustand";
import { type ComputerAccount, listAccounts } from "./api";

type Accounts = {
  running: boolean;
  items: ComputerAccount[];
  orphans: Array<{ user: string; kb: number }>;
};

/** The Linux accounts on the user's computer (VM page). Reloaded on wake/sleep and after a bot is deleted. */
type AccountsState = {
  data: Accounts | null;
  loading: boolean;
  load: () => Promise<void>;
};

let seq = 0;

export const useAccountsStore = create<AccountsState>()((set) => ({
  data: null,
  loading: false,
  load: async () => {
    // Only the newest request may write: an older, slower answer must not undo a newer one.
    const mine = ++seq;
    set({ loading: true });
    const data = await listAccounts().catch(() => null);
    if (mine === seq) set({ data, loading: false });
  },
}));
