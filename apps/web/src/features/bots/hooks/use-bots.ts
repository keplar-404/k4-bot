"use client";

import { useCallback } from "react";
import {
  BotApiError,
  type CreateBotInput,
  createAdminBot as createAdminBotApi,
  createBot as createBotApi,
  deleteBot as deleteBotApi,
  updateBot as updateBotApi,
} from "@/features/bots/api";
import { useBotList } from "./use-bot-list";

/** The user's bots plus create, update and delete, applied optimistically. */
export function useBots() {
  const {
    bots,
    setBots,
    load,
    startTransition,
    setUnauthorized,
    isInitialLoading,
    error,
    unauthorized,
  } = useBotList();

  /** Runs a change on the server, applies it here at once, then revalidates in the background. */
  const mutate = useCallback(
    async <T>(run: () => Promise<T>, apply: (result: T) => void) => {
      try {
        const result = await run();
        startTransition(() => {
          apply(result);
          void load();
        });
        return result;
      } catch (e) {
        if (e instanceof BotApiError && e.status === 401) {
          setUnauthorized(true);
        }
        throw e;
      }
    },
    [load, startTransition, setUnauthorized],
  );

  const createBot = useCallback(
    (input: CreateBotInput) =>
      // Optimistic prepend; background revalidate keeps cache consistent.
      mutate(
        () => createBotApi(input),
        (created) => setBots((current) => [created, ...current]),
      ),
    [mutate, setBots],
  );

  /** The user's admin bot (the server keeps one; a second call returns it). */
  const addAdminBot = useCallback(
    () =>
      mutate(createAdminBotApi, (admin) =>
        setBots((current) => [admin, ...current.filter((b) => b.id !== admin.id)]),
      ),
    [mutate, setBots],
  );

  const deleteBot = useCallback(
    async (id: string) => {
      await mutate(
        () => deleteBotApi(id),
        () => setBots((current) => current.filter((bot) => bot.id !== id)),
      );
    },
    [mutate, setBots],
  );

  const updateBot = useCallback(
    (id: string, input: CreateBotInput) =>
      mutate(
        () => updateBotApi(id, input),
        (updated) =>
          setBots((current) =>
            current.map((bot) => (bot.id === id ? updated : bot)),
          ),
      ),
    [mutate, setBots],
  );

  return {
    bots,
    isInitialLoading,
    error,
    unauthorized,
    createBot,
    updateBot,
    deleteBot,
    addAdminBot,
  };
}
