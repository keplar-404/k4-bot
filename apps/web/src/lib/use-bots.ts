"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useSession } from "@/lib/auth-client";
import {
  type Bot,
  BotApiError,
  type CreateBotInput,
  createBot as createBotApi,
  deleteBot as deleteBotApi,
  fetchBots,
  invalidateBots,
  updateBot as updateBotApi,
} from "@/lib/bots";

export function useBots() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = useSession();
  const [bots, setBots] = useState<Bot[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    const result = await fetchBots();
    if (result.ok) {
      setBots(result.bots);
      setError(null);
      setUnauthorized(false);
    } else if (result.status === 401) {
      setUnauthorized(true);
    } else if (result.status !== 0) {
      setError("Failed to load bots. Please try again.");
    }
    setIsInitialLoading(false);
  }, []);

  const signedIn = !isSessionPending && Boolean(session);

  useEffect(() => {
    if (isSessionPending) return;
    if (!session) {
      setIsInitialLoading(false);
      return;
    }
    startTransition(() => {
      void load();
    });
  }, [isSessionPending, session, load]);

  useEffect(() => {
    if (unauthorized) {
      invalidateBots();
      router.replace("/sign-in?callbackUrl=/dashboard");
    }
  }, [unauthorized, router]);

  const createBot = useCallback(
    async (input: CreateBotInput) => {
      try {
        const created = await createBotApi(input);
        // Optimistic prepend; background revalidate keeps cache consistent.
        startTransition(() => {
          setBots((current) => [created, ...current]);
          void load();
        });
        return created;
      } catch (e) {
        if (e instanceof BotApiError && e.status === 401) {
          setUnauthorized(true);
        }
        throw e;
      }
    },
    [load],
  );

  const deleteBot = useCallback(
    async (id: string) => {
      try {
        await deleteBotApi(id);
        startTransition(() => {
          setBots((current) => current.filter((bot) => bot.id !== id));
          void load();
        });
      } catch (e) {
        if (e instanceof BotApiError && e.status === 401) {
          setUnauthorized(true);
        }
        throw e;
      }
    },
    [load],
  );

  const updateBot = useCallback(
    async (id: string, input: CreateBotInput) => {
      try {
        const updated = await updateBotApi(id, input);
        startTransition(() => {
          setBots((current) =>
            current.map((bot) => (bot.id === id ? updated : bot)),
          );
          void load();
        });
        return updated;
      } catch (e) {
        if (e instanceof BotApiError && e.status === 401) {
          setUnauthorized(true);
        }
        throw e;
      }
    },
    [load],
  );

  return {
    bots,
    // Loading until: session resolved AND (no session OR the first fetch finished)
    isInitialLoading: isSessionPending || (signedIn && isInitialLoading),
    error,
    unauthorized,
    createBot,
    updateBot,
    deleteBot,
  };
}
