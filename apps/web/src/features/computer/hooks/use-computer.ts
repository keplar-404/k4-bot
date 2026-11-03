"use client";

import { useCallback, useState } from "react";
import { ChatHttpError } from "@/features/chat/lib/client";
import type {
  ActivityEvent,
  ComputerStatus,
  WorkingBot,
} from "@/features/computer/api";
import { computerActions } from "./computer-actions";
import { useComputerSocket } from "./use-computer-socket";
import { useKeepControl } from "./use-keep-control";
import { useSnapshot } from "./use-snapshot";

/**
 * The user's computer: status and activity over one WebSocket to the user's
 * Durable Object, plus the few actions the user can take. Nothing here starts
 * the computer by itself; only `wake()` does. Used once per page through
 * `ComputerProvider`, so the panel and the chat share one connection.
 */
export function useComputer() {
  const [status, setStatus] = useState<ComputerStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  /** The action in flight, so its button can show a spinner while the others are disabled. */
  const [pending, setPending] = useState<ComputerAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Local clock time the session ends, from the server's "ms left" (immune to clock skew). */
  const [sessionEndsAt, setSessionEndsAt] = useState<number | null>(null);
  /** Bots that were using the computer when the user tried to put it to sleep: the page asks before going on. */
  const [blockers, setBlockers] = useState<{
    bots: WorkingBot[];
    at: number;
  } | null>(null);

  const applyStatus = useCallback((s: ComputerStatus) => {
    setStatus(s);
    setSessionEndsAt(s.session ? Date.now() + s.session.endsInMs : null);
  }, []);

  useComputerSocket(applyStatus, setActivity);
  const snapshot = useSnapshot(status?.snapshotAt);
  const inControl = status?.lease?.kind === "user";
  useKeepControl(inControl);

  const run = useCallback(
    async (name: ComputerAction, action: () => Promise<unknown>) => {
      setPending(name);
      setError(null);
      try {
        await action();
      } catch (e) {
        setError(
          e instanceof ChatHttpError ? e.info.message : "Something went wrong.",
        );
      } finally {
        setPending(null);
      }
    },
    [],
  );

  return {
    status,
    activity,
    busy: pending !== null,
    pending,
    error,
    inControl,
    sessionEndsAt,
    snapshot,
    blockers,
    dismissBlockers: () => setBlockers(null),
    ...computerActions({ run, applyStatus, setStatus, setBlockers, setError }),
  };
}

export type Computer = ReturnType<typeof useComputer>;
export type ComputerAction = "wake" | "pause" | "wrap" | "take" | "release";
