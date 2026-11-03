"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useSession } from "@/features/auth/auth-client";
import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { type Bot, fetchBots, invalidateBots } from "@/features/bots/api";

/** The signed-in user's bots: loaded once the session is known, reloaded by `load`; a 401 goes to sign-in. */
export function useBotList() {
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
      redirectToSignIn();
    }
  }, [unauthorized]);

  return {
    bots,
    setBots,
    load,
    startTransition,
    setUnauthorized,
    // Loading until: session resolved AND (no session OR the first fetch finished)
    isInitialLoading: isSessionPending || (signedIn && isInitialLoading),
    error,
    unauthorized,
  };
}
