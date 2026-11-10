"use client";

import { useBotsStore } from "@/features/bots/store";
import { useBotList } from "./use-bot-list";

/** The user's bots plus create, update and delete; every change updates the shared store (all views at once). */
export function useBots() {
  const list = useBotList();
  const createBot = useBotsStore((s) => s.createBot);
  const updateBot = useBotsStore((s) => s.updateBot);
  const deleteBot = useBotsStore((s) => s.deleteBot);
  const addAdminBot = useBotsStore((s) => s.addAdminBot);
  return { ...list, createBot, updateBot, deleteBot, addAdminBot };
}
