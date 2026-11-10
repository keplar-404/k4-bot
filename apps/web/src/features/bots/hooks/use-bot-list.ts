"use client";

import { useEffect } from "react";
import { useSession } from "@/features/auth/auth-client";
import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { invalidateBots } from "@/features/bots/api";
import { useBotsStore } from "@/features/bots/store";

/** The signed-in user's bots, from the shared store: loaded once the session is known; a 401 goes to sign-in. */
export function useBotList() {
  const { data: session, isPending: isSessionPending } = useSession();
  const bots = useBotsStore((s) => s.bots);
  const loaded = useBotsStore((s) => s.loaded);
  const error = useBotsStore((s) => s.error);
  const unauthorized = useBotsStore((s) => s.unauthorized);
  const load = useBotsStore((s) => s.load);
  const reset = useBotsStore((s) => s.reset);

  useEffect(() => {
    if (isSessionPending) return;
    if (!session) reset();
    else if (!useBotsStore.getState().loaded) void load();
  }, [isSessionPending, session, load, reset]);

  useEffect(() => {
    if (unauthorized) {
      invalidateBots();
      redirectToSignIn();
    }
  }, [unauthorized]);

  return {
    bots,
    load,
    // Loading until: session resolved AND (no session OR the first fetch finished)
    isInitialLoading: isSessionPending || (Boolean(session) && !loaded),
    error,
    unauthorized,
  };
}
